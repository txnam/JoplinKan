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

function normalizeBody(value: string | undefined): string {
	return (value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function headingTitle(title: string): string {
	const safeTitle = safeHeadingTitle(title);
	return safeTitle;
}

function serializeCard(card: Card): string[] {
	const color = normalizeColor(card.color, DEFAULT_CARD_COLOR);
	const title = headingTitle(card.title);
	const titleWithColor = color === DEFAULT_CARD_COLOR ? title : `${title} ${colorMarker(color)}`;
	const lines = [
		`- ${titleWithColor}`,
	];

	const body = normalizeBody(card.body);
	if (body) {
		lines.push(...body.split('\n').map(indentListContinuation));
	}

	return lines;
}

function serializeColumn(column: Column): string[] {
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
		lines.push(...serializeCard(card));
		wroteCard = true;
	}

	return lines;
}

export function serializeBoard(board: Board): string {
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
		sections.push(...serializeColumn(column));
	}

	if (sections.length) sections.push('');
	sections.push(
		`\`\`\`${KANBAN_SETTINGS_FENCE}`,
		`version: ${settings.version}`,
		`plugin: ${settings.plugin}`,
		`defaultColumnColor: "${settings.defaultColumnColor}"`,
		`defaultCardColor: "${settings.defaultCardColor}"`,
		'```',
	);

	if (epilogue) {
		sections.push('', epilogue);
	}

	return `${sections.join('\n')}\n`;
}
