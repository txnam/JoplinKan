import MarkdownIt from 'markdown-it';

type BreakLocation = { line: number; hard: boolean };
type BreakEnvironment = {
	source: string;
	startLine: number;
	locations: BreakLocation[];
};

// Only inspect Markdown. No generated HTML is injected into the Kanban webview.
const markdown = new MarkdownIt({ html: true, breaks: false });
markdown.inline.ruler.before('newline', 'detail_break_location', (state, silent) => {
	const env = state.env as Partial<BreakEnvironment>;
	if (!silent && env.source === state.src && env.locations && state.src[state.pos] === '\n') {
		env.locations.push({
			line: env.startLine! + state.src.slice(0, state.pos).split('\n').length - 1,
			hard: state.pending.endsWith('  '),
		});
	}
	// Let markdown-it consume the newline normally, including existing hard breaks.
	return false;
});

/** Avoid a blank paragraph unless the leading block needs one to keep its meaning. */
export function detailSeparator(body: string): 'hardbreak' | 'none' | 'blank' {
	const first = markdown.parse(body, {})[0];
	// Leading reference definitions disappear from the token stream. They need
	// separation from the title, including a body made entirely of definitions.
	if (!first?.map || first.map[0] !== 0) return 'blank';
	if (first.type === 'paragraph_open') return 'hardbreak';
	if (first.type === 'fence' || first.type === 'blockquote_open') return 'none';
	if (first.type === 'heading_open' && /^ {0,3}#{1,6}\s/.test(body)) return 'none';
	if (first.type === 'bullet_list_open' && /^ {0,3}[-+*][ \t]+\S/.test(body)) return 'none';
	if (first.type === 'ordered_list_open' && /^ {0,3}1[.)][ \t]+\S/.test(body)) return 'none';
	// Indented code cannot interrupt a paragraph. Tables, setext headings,
	// reference definitions and other blocks may also absorb/change the title.
	return 'blank';
}

function paragraphBreaks(body: string): BreakLocation[] {
	const environment = {};
	const tokens = markdown.parse(body, environment);
	const locations: BreakLocation[] = [];
	for (let index = 1; index < tokens.length; index++) {
		const token = tokens[index];
		if (token.type !== 'inline' || !token.map || tokens[index - 1].type !== 'paragraph_open') continue;
		// Reparse the paragraph to record source lines. Code spans, HTML tags, link
		// destinations, etc. consume their own newlines and never reach this rule.
		markdown.inline.parse(token.content, markdown, {
			...environment, source: token.content, startLine: token.map[0], locations,
		}, []);
	}
	return locations;
}

/** Persist explicit line breaks, changing only soft breaks within paragraphs. */
export function encodeDetailLineBreaks(body: string): string {
	const normalized = body.replace(/\r\n?/g, '\n');
	const lines = normalized.split('\n');
	for (const { line, hard } of paragraphBreaks(normalized)) {
		if (hard || /<br\s*\/?>[ \t]*$/i.test(lines[line])) continue;
		lines[line] = lines[line].replace(/ +$/, '') + '  ';
	}
	return lines.join('\n');
}

/** Hide Markdown's technical trailing spaces in the editable detail model. */
export function decodeDetailLineBreaks(body: string): string {
	const normalized = body.replace(/\r\n?/g, '\n');
	const lines = normalized.split('\n');
	for (const { line, hard } of paragraphBreaks(normalized)) {
		if (hard) lines[line] = lines[line].replace(/ {2,}$/, '');
	}
	return lines.join('\n');
}
