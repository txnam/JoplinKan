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
import { isValidId, parseHeading, parseListCard, normalizeColor, normalizeIcon, unindentListContinuation } from './metadata';
import { uniqueId } from './id';
import { decodeDetailLineBreaks } from './detailLineBreaks';

type SettingsBlock = {
	start: number;
	end: number;
	settings: Record<string, string>;
};

function splitLines(markdown: string): string[] {
	return markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

function trimBlankLines(lines: string[]): string {
	let start = 0;
	let end = lines.length;

	while (start < end && lines[start].trim() === '') start += 1;
	while (end > start && lines[end - 1].trim() === '') end -= 1;

	return lines.slice(start, end).join('\n');
}

type Fence = { character: string; length: number } | null;
function advanceFence(line: string, fence: Fence): Fence {
 const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
 if (!match) return fence;
 if (fence) return match[1][0] === fence.character && match[1].length >= fence.length && !match[2].trim() ? null : fence;
 return { character: match[1][0], length: match[1].length };
}

function parseSettings(lines: string[]): Record<string, string> {
	const settings: Record<string, string> = {};

	for (const line of lines) {
		const match = /^\s*([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*$/.exec(line);
		if (!match) continue;

		settings[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
	}

	return settings;
}

function findSettingsBlock(lines: string[]): SettingsBlock | null {
	let fence: Fence = null;
	for (let index = 0; index < lines.length; index += 1) {
        if (fence) { fence = advanceFence(lines[index], fence); continue; }
        if (!lines[index].startsWith("```kanban-settings")) { fence = advanceFence(lines[index], fence); continue; }
		if (lines[index].trim() !== `\`\`\`${KANBAN_SETTINGS_FENCE}`) continue;

		for (let end = index + 1; end < lines.length; end += 1) {
			if (lines[end].trim() === '```') {
				return {
					start: index,
					end,
					settings: parseSettings(lines.slice(index + 1, end)),
				};
			}
		}

		throw new Error('The kanban-settings block is missing its closing ``` fence.');
	}

	return null;
}

function pushCard(currentCard: Card | null, currentCardBody: string[]): Card | null {
	if (!currentCard) return null;
	currentCard.body = decodeDetailLineBreaks(trimBlankLines(currentCardBody));
	return currentCard;
}

function resolveId(candidate: string | undefined, title: string, usedIds: Set<string>): string {
	if (isValidId(candidate) && !usedIds.has(candidate)) {
		usedIds.add(candidate);
		return candidate;
	}

	return uniqueId(title, usedIds);
}

export function isKanbanMarkdown(markdown: string): boolean {
	try { return !!findSettingsBlock(splitLines(markdown)); } catch { return true; }
}

export function parseBoard(markdown: string): Board {
	const lines = splitLines(markdown);
	const settingsBlock = findSettingsBlock(lines);

	if (!settingsBlock) {
		throw new Error('The note does not contain a kanban-settings block.');
	}

	if (settingsBlock.settings.plugin && settingsBlock.settings.plugin !== PLUGIN_ID) {
		throw new Error(`Unsupported Kanban plugin: ${settingsBlock.settings.plugin}.`);
	}

	if (settingsBlock.settings.version && settingsBlock.settings.version !== '1') throw new Error('Unsupported Kanban version.');
 const defaultColumnColor = normalizeColor(settingsBlock.settings.defaultColumnColor, DEFAULT_COLUMN_COLOR);
 const defaultCardColor = normalizeColor(settingsBlock.settings.defaultCardColor, DEFAULT_CARD_COLOR);
 const contentLines = lines.slice(0, settingsBlock.start);
	const epilogue = trimBlankLines(lines.slice(settingsBlock.end + 1));
	const usedColumnIds = new Set<string>();
	const usedCardIds = new Set<string>();
	const columns: Column[] = [];
	const preambleLines: string[] = [];

	let currentColumn: Column | null = null;
	let currentColumnBody: string[] = [];
	let currentCard: Card | null = null;
	let currentCardBody: string[] = [];
	let currentCardSource: 'heading' | 'list' | null = null;
	let fence: Fence = null;
 let continuationIndent = 2;

	const finishCard = () => {
		const completedCard = pushCard(currentCard, currentCardBody);
		if (completedCard && currentColumn) {
			currentColumn.cards.push(completedCard);
		}
		currentCard = null;
		currentCardSource = null;
		currentCardBody = [];
	};

	const finishColumn = () => {
		finishCard();
		if (currentColumn) {
			currentColumn.body = trimBlankLines(currentColumnBody);
			columns.push(currentColumn);
		}
		currentColumn = null;
		currentColumnBody = [];
	};

	for (const line of contentLines) {
		const heading = !fence ? parseHeading(line) : null;
		const listCard = !fence && !heading && currentCardSource !== 'heading' ? parseListCard(line) : null;

		if (heading?.level === 1) {
			finishColumn();
			const id = resolveId(heading.metadata.id, heading.title, usedColumnIds);
			currentColumn = {
				id,
				title: heading.title,
				body: '',
				color: normalizeColor(heading.metadata.color, defaultColumnColor),
				icon: normalizeIcon(heading.metadata.icon),
				cards: [],
			};
		} else if (heading?.level === 2) {
			if (!currentColumn) {
				const id = uniqueId('Backlog', usedColumnIds);
				currentColumn = {
					id,
					title: 'Backlog',
					body: '',
					color: defaultColumnColor,
					icon: '📥',
					cards: [],
				};
			}

			finishCard();
			const id = resolveId(heading.metadata.id, heading.title, usedCardIds);
			currentCard = {
				id,
				title: heading.title,
				body: '',
				color: normalizeColor(heading.metadata.color, defaultCardColor),
				icon: normalizeIcon(heading.metadata.icon),
			};
			currentCardSource = 'heading';
		} else if (listCard) {
			if (!currentColumn) {
				const id = uniqueId('Backlog', usedColumnIds);
				currentColumn = {
					id,
					title: 'Backlog',
					body: '',
					color: defaultColumnColor,
					icon: '',
					cards: [],
				};
			}

			finishCard();
			const id = resolveId(listCard.metadata.id, listCard.title, usedCardIds);
			currentCard = {
				id,
				title: listCard.title,
				body: '',
				color: normalizeColor(listCard.metadata.color, defaultCardColor),
				icon: normalizeIcon(listCard.metadata.icon),
			};
			currentCardSource = 'list';
            continuationIndent = /^[-*+]([ \t]+)/.exec(line)![0].replace(/\t/g, '   ').length;
		} else if (currentCard) {
			currentCardBody.push(currentCardSource === 'list' ? unindentListContinuation(line, continuationIndent) : line);
		} else if (currentColumn) {
			currentColumnBody.push(line);
		} else {
			preambleLines.push(line);
		}

		const fenceLine = currentCardSource === 'list' ? unindentListContinuation(line, continuationIndent) : line;
        fence = advanceFence(fenceLine, fence);
	}

	finishColumn();

	return {
		version: 1,
		settings: {
			...DEFAULT_SETTINGS,
			defaultColumnColor: normalizeColor(settingsBlock.settings.defaultColumnColor, DEFAULT_COLUMN_COLOR),
			defaultCardColor: normalizeColor(settingsBlock.settings.defaultCardColor, DEFAULT_CARD_COLOR),
		},
		columns,
		extraSettingsLines: lines.slice(settingsBlock.start + 1, settingsBlock.end).filter(line => !/^\s*(version|plugin|defaultColumnColor|defaultCardColor)\s*:/.test(line)),
        preamble: trimBlankLines(preambleLines),
		epilogue,
	};
}
