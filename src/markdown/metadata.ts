import { DEFAULT_ICON } from './types';

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const NAMED_COLORS: Record<string, string> = {
	black: '#111827',
	blue: '#2563eb',
	cyan: '#0891b2',
	gray: '#64748b',
	green: '#16a34a',
	grey: '#64748b',
	orange: '#ea580c',
	pink: '#db2777',
	purple: '#9333ea',
	red: '#dc2626',
	white: '#ffffff',
	yellow: '#ca8a04',
};

export type HeadingMetadata = {
	id?: string;
	color?: string;
	icon?: string;
};

export type ParsedHeading = {
	level: number;
	title: string;
	metadata: HeadingMetadata;
};

export type ParsedListCard = {
	title: string;
	metadata: HeadingMetadata;
};

export function isValidColor(value: string | undefined): value is string {
	return !!value && COLOR_PATTERN.test(value);
}

export function isValidId(value: string | undefined): value is string {
	return !!value && ID_PATTERN.test(value);
}

export function normalizeColor(value: string | undefined, fallback: string): string {
	return isValidColor(value) ? value.toLowerCase() : fallback;
}

export function normalizeIcon(value: string | undefined): string {
	if (!value) return DEFAULT_ICON;
	const trimmed = value.trim();
	if (!trimmed || trimmed.includes(';') || trimmed.includes('<') || trimmed.includes('>')) return DEFAULT_ICON;
	return Array.from(trimmed).slice(0, 4).join('');
}

export function colorMarker(color: string): string {
	return `[[${color}]]`;
}

export function parseMetadata(raw: string): HeadingMetadata {
	const metadata: HeadingMetadata = {};

	for (const part of raw.split(';')) {
		const separator = part.includes('=') ? '=' : ':';
		const [key, ...valueParts] = part.split(separator);
		const value = valueParts.join(separator).trim();
		const normalizedKey = key.trim();

		if (!normalizedKey || !value) continue;
		if (normalizedKey === 'id') metadata.id = value;
		if (normalizedKey === 'color') metadata.color = value;
		if (normalizedKey === 'icon') metadata.icon = value;
	}

	return metadata;
}

function parseColorComment(raw: string): HeadingMetadata {
	const match = /^color\s*[:=]\s*(#[0-9a-fA-F]{6})\s*$/.exec(raw.trim());
	return match ? { color: match[1] } : {};
}

function parseColorMarker(raw: string): HeadingMetadata {
	const value = raw.trim().toLowerCase();
	if (isValidColor(value)) return { color: value };
	if (NAMED_COLORS[value]) return { color: NAMED_COLORS[value] };
	return {};
}

function stripTrailingColorMarker(rawTitle: string): { title: string; metadata: HeadingMetadata } {
	const compactMarkerMatch = /\s*\\?\[\\?\[\s*(#[0-9a-fA-F]{6}|[A-Za-z]+)\s*\\?\]\\?\]\s*$/.exec(rawTitle);
	if (compactMarkerMatch) {
		return {
			title: rawTitle.slice(0, compactMarkerMatch.index).trim(),
			metadata: parseColorMarker(compactMarkerMatch[1]),
		};
	}

	const colorMarkerMatch = /\s*\\?\[\s*(color\s*[:=]\s*#[0-9a-fA-F]{6})\s*\\?\]\s*$/.exec(rawTitle);
	if (!colorMarkerMatch) return { title: rawTitle, metadata: {} };

	return {
		title: rawTitle.slice(0, colorMarkerMatch.index).trim(),
		metadata: parseColorComment(colorMarkerMatch[1]),
	};
}

export function parseHeading(line: string): ParsedHeading | null {
	const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
	if (!match) return null;

	const level = match[1].length;
	let rawTitle = match[2].trim();
	let metadata: HeadingMetadata = {};

	const commentMatch = /\s*<!--\s*(kanban-column|kanban-card):([^>]*)-->\s*$/.exec(rawTitle);
	if (commentMatch) {
		metadata = parseMetadata(commentMatch[2]);
		rawTitle = rawTitle.slice(0, commentMatch.index).trim();
	} else {
		const colorCommentMatch = /\s*<!--\s*(color\s*[:=]\s*#[0-9a-fA-F]{6})\s*-->\s*$/.exec(rawTitle);
		if (colorCommentMatch) {
			metadata = parseColorComment(colorCommentMatch[1]);
			rawTitle = rawTitle.slice(0, colorCommentMatch.index).trim();
		} else {
			const stripped = stripTrailingColorMarker(rawTitle);
			metadata = stripped.metadata;
			rawTitle = stripped.title;
		}
	}

	const icon = normalizeIcon(metadata.icon);
	const title = icon && rawTitle.startsWith(`${icon} `)
		? rawTitle.slice(icon.length + 1).trim()
		: rawTitle;

	return { level, title, metadata };
}

export function parseListCard(line: string): ParsedListCard | null {
	const match = /^[-*+]\s+(.+?)\s*$/.exec(line);
	if (!match) return null;

	let rawTitle = match[1].trim();
	let metadata: HeadingMetadata = {};

	const commentMatch = /\s*<!--\s*kanban-card:([^>]*)-->\s*$/.exec(rawTitle);
	if (commentMatch) {
		metadata = parseMetadata(commentMatch[1]);
		rawTitle = rawTitle.slice(0, commentMatch.index).trim();
	} else {
		const colorCommentMatch = /\s*<!--\s*(color\s*[:=]\s*#[0-9a-fA-F]{6})\s*-->\s*$/.exec(rawTitle);
		if (colorCommentMatch) {
			metadata = parseColorComment(colorCommentMatch[1]);
			rawTitle = rawTitle.slice(0, colorCommentMatch.index).trim();
		} else {
			const stripped = stripTrailingColorMarker(rawTitle);
			metadata = stripped.metadata;
			rawTitle = stripped.title;
		}
	}

	const icon = normalizeIcon(metadata.icon);
	const title = icon && rawTitle.startsWith(`${icon} `)
		? rawTitle.slice(icon.length + 1).trim()
		: rawTitle;

	return { title, metadata };
}

export function unindentListContinuation(line: string): string {
	return line.replace(/^ {2}/, '');
}

export function indentListContinuation(line: string): string {
	return line ? `  ${line}` : '';
}

export function safeHeadingTitle(title: string): string {
	const normalized = title.replace(/\s+/g, ' ').trim();
	return normalized || 'Untitled';
}
