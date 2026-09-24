import {
	Board,
	Card,
	Column,
	DEFAULT_CARD_COLOR,
	DEFAULT_COLUMN_COLOR,
	DEFAULT_SETTINGS,
	KANBAN_SETTINGS_FENCE,
	PLUGIN_ID,
} from './types';
import {
	colorMarker,
	indentListContinuation,
	normalizeColor,
	safeHeadingTitle,
} from './metadata';
import { detailSeparator, encodeDetailLineBreaks } from './detailLineBreaks';

function normalizeBody(value: string | undefined): string {
 return (value || '').replace(/\r\n?/g, '\n').replace(/^(?:[ \t]*\n)+|(?:\n[ \t]*)+$/g, '');
}

function headingTitle(title: string): string {
	const safeTitle = safeHeadingTitle(title);
	return safeTitle;
}

function serializeCard(card: Card, defaultColor: string): string[] {
	const color = normalizeColor(card.color, DEFAULT_CARD_COLOR);
	const title = headingTitle(card.title);
	const titleWithColor = color === defaultColor ? title : `${title} ${colorMarker(color)}`;
	const lines = [
		`- ${titleWithColor}`,
	];

	const body = normalizeBody(card.body);
	if (body) {
		const separator = detailSeparator(body);
		if (separator === 'hardbreak') lines[0] += '  ';
		if (separator === 'blank') lines.push('');
		lines.push(...encodeDetailLineBreaks(body).split('\n').map(indentListContinuation));
	}

	return lines;
}

function serializeColumn(column: Column, defaultCardColor: string): string[] {
	const color = normalizeColor(column.color, DEFAULT_COLUMN_COLOR);
	const title = headingTitle(column.title);
	const lines = [
		`# ${title} ${colorMarker(color)}`,
	];

	const body = normalizeBody(column.body);
	if (body) {
		lines.push('', body);
	}

	let wroteCard = false;
	for (const card of column.cards || []) {
		if (body && !wroteCard && lines[lines.length - 1] !== '') lines.push('');
		lines.push(...serializeCard(card, defaultCardColor));
		wroteCard = true;
	}

	return lines;
}

export function serializeBoard(board: Board): string {
	if (board.version !== 1 || (board.settings?.version && board.settings.version !== 1)) throw new Error('Unsupported Kanban version.');
	const settings = {
		...DEFAULT_SETTINGS,
		...board.settings,
		plugin: PLUGIN_ID,
		version: 1,
		defaultColumnColor: normalizeColor(board.settings?.defaultColumnColor, DEFAULT_COLUMN_COLOR),
		defaultCardColor: normalizeColor(board.settings?.defaultCardColor, DEFAULT_CARD_COLOR),
	};

	const sections: string[] = [];
	const preamble = normalizeBody(board.preamble);
	const epilogue = normalizeBody(board.epilogue);

	if (preamble) sections.push(preamble);

	for (const column of board.columns || []) {
		if (sections.length) sections.push('');
		sections.push(...serializeColumn(column, settings.defaultCardColor));
	}

	if (sections.length) sections.push('');
	sections.push(
		`\`\`\`${KANBAN_SETTINGS_FENCE}`,
		`version: ${settings.version}`,
		`plugin: ${settings.plugin}`,
		`defaultColumnColor: "${settings.defaultColumnColor}"`,
		`defaultCardColor: "${settings.defaultCardColor}"`,
        ...(board.extraSettingsLines || []),
		'```',
	);

	if (epilogue) {
		sections.push('', epilogue);
	}

	return `${sections.join('\n')}\n`;
}
