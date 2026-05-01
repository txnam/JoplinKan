import {
	Board,
	Card,
	Column,
	COLOR_PALETTE,
	DEFAULT_CARD_COLOR,
	DEFAULT_COLUMN_COLOR,
	ICON_GROUPS,
} from '../markdown/types';

type WebviewApi = {
	postMessage: (message: unknown) => Promise<unknown>;
	onMessage: (callback: (event: PluginMessageEvent | PluginMessage) => void) => void;
};

type PluginMessage =
	| { type: 'board'; noteId: string; board: Board }
	| { type: 'error'; message: string }
	| { type: 'empty'; message: string };

type PluginMessageEvent = {
	message: PluginMessage;
};

type OpenMenu =
	| { type: 'column'; columnId: string }
	| { type: 'card'; columnId: string; cardId: string }
	| null;

type DragState = {
	type: 'card';
	cardId: string;
	fromColumnId: string;
} | {
	type: 'column';
	columnId: string;
} | null;

type DialogState =
	| {
		type: 'text';
		title: string;
		label: string;
		value: string;
		confirmLabel: string;
		onSubmit: (value: string) => void;
	}
	| {
		type: 'multiline';
		title: string;
		label: string;
		value: string;
		confirmLabel: string;
		onSubmit: (value: string) => void;
	}
	| {
		type: 'confirm';
		title: string;
		message: string;
		confirmLabel: string;
		destructive: boolean;
		onConfirm: () => void;
	}
	| null;

declare const webviewApi: WebviewApi;

let board: Board | null = null;
let noteId = '';
let saveTimer: number | undefined;
let saveInFlight: Promise<boolean> | null = null;
let saveRequestSequence = 0;
let dragState: DragState = null;
let openMenu: OpenMenu = null;
let dialogState: DialogState = null;
let iconsExpanded = false;
let statusText = '';
let errorText = '';
let emptyText = '';
let suppressTextDrag = false;

const root = document.getElementById('app');

function cloneBoard(value: Board): Board {
	return JSON.parse(JSON.stringify(value)) as Board;
}

function uid(prefix: string): string {
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function toolbarIcons(): Array<{ icon: string; label: string }> {
	return ICON_GROUPS.flatMap(group => group.items);
}

function visibleToolbarIcons(): Array<{ icon: string; label: string }> {
	return iconsExpanded ? toolbarIcons() : toolbarIcons().slice(0, 20);
}

function findColumn(columnId: string): Column | undefined {
	return board?.columns.find(column => column.id === columnId);
}

function findCard(column: Column, cardId: string): Card | undefined {
	return column.cards.find(card => card.id === cardId);
}

function menuKey(menu: OpenMenu): string {
	if (!menu) return '';
	return menu.type === 'column' ? `column:${menu.columnId}` : `card:${menu.columnId}:${menu.cardId}`;
}

function openTextDialog(
	title: string,
	label: string,
	value: string,
	confirmLabel: string,
	onSubmit: (value: string) => void,
): void {
	dialogState = { type: 'text', title, label, value, confirmLabel, onSubmit };
	openMenu = null;
	render();
	window.setTimeout(() => {
		const input = document.querySelector<HTMLInputElement>('[data-role="dialog-input"]');
		input?.focus();
		input?.select();
	}, 0);
}

function openMultilineDialog(
	title: string,
	label: string,
	value: string,
	confirmLabel: string,
	onSubmit: (value: string) => void,
): void {
	dialogState = { type: 'multiline', title, label, value, confirmLabel, onSubmit };
	openMenu = null;
	render();
	window.setTimeout(() => {
		const input = document.querySelector<HTMLTextAreaElement>('[data-role="dialog-input"]');
		input?.focus();
	}, 0);
}

function openConfirmDialog(
	title: string,
	message: string,
	confirmLabel: string,
	destructive: boolean,
	onConfirm: () => void,
): void {
	dialogState = { type: 'confirm', title, message, confirmLabel, destructive, onConfirm };
	openMenu = null;
	render();
}

function closeDialog(): void {
	if (!dialogState) return;
	dialogState = null;
	render();
}

function submitTextDialog(): void {
	if (!dialogState || (dialogState.type !== 'text' && dialogState.type !== 'multiline')) return;

	const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>('[data-role="dialog-input"]');
	const value = dialogState.type === 'text'
		? (input?.value || '').replace(/\s+/g, ' ').trim()
		: (input?.value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

	if (dialogState.type === 'text' && !value) {
		input?.focus();
		return;
	}

	const submit = dialogState.onSubmit;
	dialogState = null;
	submit(value);
}

function confirmDialog(): void {
	if (!dialogState || dialogState.type !== 'confirm') return;

	const confirm = dialogState.onConfirm;
	dialogState = null;
	confirm();
}

function isMenuOpen(key: string): boolean {
	return menuKey(openMenu) === key;
}

function closeMenu(): void {
	if (!openMenu) return;
	openMenu = null;
	render();
}

function cancelPendingSave(): void {
	window.clearTimeout(saveTimer);
	saveTimer = undefined;
	saveRequestSequence += 1;
	saveInFlight = null;
}

function cardElement(cardId: string): HTMLElement | null {
	return root?.querySelector<HTMLElement>(`.kanban-card[data-card-id="${cardId}"]`) || null;
}

function cardListElement(columnId: string): HTMLElement | null {
	return root?.querySelector<HTMLElement>(`.card-list[data-drop-column-id="${columnId}"]`) || null;
}

function updateColumnCount(columnId: string): void {
	const column = findColumn(columnId);
	const columnElement = root?.querySelector<HTMLElement>(`.kanban-column[data-column-id="${columnId}"]`);
	const countElement = columnElement?.querySelector<HTMLElement>('.column-count');
	if (column && countElement) countElement.textContent = String(column.cards.length);
}

function emptyColumnButton(columnId: string): HTMLButtonElement {
	const button = document.createElement('button');
	button.className = 'empty-column';
	button.type = 'button';
	button.dataset.action = 'add-card';
	button.dataset.columnId = columnId;
	button.textContent = '+ First task';
	return button;
}

function syncEmptyColumnState(columnId: string): void {
	const column = findColumn(columnId);
	const listElement = cardListElement(columnId);
	if (!column || !listElement) return;

	const emptyButton = listElement.querySelector<HTMLElement>('.empty-column');
	if (column.cards.length === 0) {
		if (!emptyButton) listElement.appendChild(emptyColumnButton(columnId));
		return;
	}

	emptyButton?.remove();
}

function moveCardElement(cardId: string, toColumnId: string, beforeCardId?: string): boolean {
	const draggedElement = cardElement(cardId);
	const toListElement = cardListElement(toColumnId);
	if (!draggedElement || !toListElement) return false;

	const beforeElement = beforeCardId ? cardElement(beforeCardId) : null;
	draggedElement.dataset.columnId = toColumnId;
	draggedElement.querySelectorAll<HTMLElement>('[data-column-id]').forEach(element => {
		element.dataset.columnId = toColumnId;
	});

	toListElement.insertBefore(draggedElement, beforeElement);
	return true;
}

function moveCard(toColumnId: string, beforeCardId?: string): void {
	if (!board || !dragState || dragState.type !== 'card') return;

	const fromColumn = findColumn(dragState.fromColumnId);
	const toColumn = findColumn(toColumnId);
	if (!fromColumn || !toColumn) return;
	if (fromColumn.id === toColumn.id && beforeCardId === dragState.cardId) return;

	const draggedCardId = dragState.cardId;
	const fromIndex = fromColumn.cards.findIndex(card => card.id === draggedCardId);
	if (fromIndex < 0) return;

	const [card] = fromColumn.cards.splice(fromIndex, 1);
	let toIndex = beforeCardId ? toColumn.cards.findIndex(item => item.id === beforeCardId) : toColumn.cards.length;
	if (toIndex < 0) toIndex = toColumn.cards.length;
	toColumn.cards.splice(toIndex, 0, card);

	openMenu = null;
	if (!moveCardElement(draggedCardId, toColumn.id, beforeCardId)) {
		render();
	} else {
		updateColumnCount(fromColumn.id);
		updateColumnCount(toColumn.id);
		syncEmptyColumnState(fromColumn.id);
		syncEmptyColumnState(toColumn.id);
	}
	saveSoon(0);
}

function moveColumn(beforeColumnId?: string): void {
	if (!board || !dragState || dragState.type !== 'column') return;
	if (beforeColumnId === dragState.columnId) return;

	const draggedColumnId = dragState.columnId;
	const fromIndex = board.columns.findIndex(column => column.id === draggedColumnId);
	if (fromIndex < 0) return;

	const [column] = board.columns.splice(fromIndex, 1);
	let toIndex = beforeColumnId ? board.columns.findIndex(item => item.id === beforeColumnId) : board.columns.length;
	if (toIndex < 0) toIndex = board.columns.length;
	board.columns.splice(toIndex, 0, column);

	openMenu = null;
	render();
	saveSoon(0);
}

function findDropPosition(event: DragEvent): { columnId: string; beforeCardId?: string } | null {
	if (!root) return null;

	const cardTarget = (event.target as HTMLElement).closest<HTMLElement>('.kanban-card');
	const listTarget = (event.target as HTMLElement).closest<HTMLElement>('.card-list');
	const columnId = cardTarget?.dataset.columnId || listTarget?.dataset.dropColumnId;
	if (!columnId) return null;

	const listElement = Array.from(root.querySelectorAll<HTMLElement>('.card-list'))
		.find(element => element.dataset.dropColumnId === columnId);
	if (!listElement) return { columnId };

	const cards = Array.from(listElement.querySelectorAll<HTMLElement>('.kanban-card:not(.is-dragging)'));
	for (const card of cards) {
		const rect = card.getBoundingClientRect();
		if (event.clientY < rect.top + rect.height / 2) {
			return { columnId, beforeCardId: card.dataset.cardId };
		}
	}

	return { columnId };
}

function findColumnDropPosition(event: DragEvent): { beforeColumnId?: string } | null {
	if (!root) return null;
	const boardElement = (event.target as HTMLElement).closest<HTMLElement>('.board');
	if (!boardElement) return null;

	const columns = Array.from(root.querySelectorAll<HTMLElement>('.kanban-column:not(.is-dragging-column)'));
	for (const column of columns) {
		const rect = column.getBoundingClientRect();
		if (event.clientX < rect.left + rect.width / 2) {
			return { beforeColumnId: column.dataset.columnId };
		}
	}

	return {};
}

async function saveNow(): Promise<boolean> {
	window.clearTimeout(saveTimer);
	saveTimer = undefined;
	if (!board || !noteId) return true;

	if (saveInFlight) return saveInFlight;

	const requestSequence = ++saveRequestSequence;
	const requestNoteId = noteId;
	const requestBoard = cloneBoard(board);
	statusText = 'Saving...';
	renderStatus();

	saveInFlight = webviewApi.postMessage({
		type: 'saveBoard',
		noteId: requestNoteId,
		board: requestBoard,
	}).then(response => {
		const result = response as { ok?: boolean; message?: string };
		if (requestSequence !== saveRequestSequence || noteId !== requestNoteId) {
			return !!result?.ok;
		}

		if (result?.ok) {
			statusText = 'Saved';
			errorText = '';
			return true;
		}

		statusText = 'Save failed';
		errorText = result?.message || 'Could not save the Kanban board.';
		return false;
	}).catch(error => {
		if (requestSequence !== saveRequestSequence || noteId !== requestNoteId) {
			return false;
		}

		statusText = 'Save failed';
		errorText = error instanceof Error ? error.message : 'Could not save the Kanban board.';
		return false;
	}).finally(() => {
		if (requestSequence === saveRequestSequence) {
			saveInFlight = null;
			renderStatus();
		}
	});

	return saveInFlight;
}

async function copyText(value: string): Promise<void> {
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(value);
		} else {
			const textarea = document.createElement('textarea');
			textarea.value = value;
			textarea.style.position = 'fixed';
			textarea.style.left = '-9999px';
			document.body.appendChild(textarea);
			textarea.focus();
			textarea.select();
			document.execCommand('copy');
			textarea.remove();
		}

		statusText = `Copied ${value}`;
		errorText = '';
	} catch (error) {
		statusText = 'Copy failed';
		errorText = error instanceof Error ? error.message : 'Could not copy the icon.';
	}

	renderStatus();
}

function saveSoon(delay = 450): void {
	if (!board) return;
	window.clearTimeout(saveTimer);
	statusText = 'Waiting to save...';
	renderStatus();

	saveTimer = window.setTimeout(() => {
		saveNow();
	}, delay);
}

function renderStatus(): void {
	const status = document.querySelector('[data-role="status"]');
	if (status) status.textContent = statusText;

	const error = document.querySelector('[data-role="error"]');
	if (error) {
		error.textContent = errorText;
		error.classList.toggle('is-hidden', !errorText);
	}
}

function updateColumn(columnId: string, patch: Partial<Column>, saveDelay = 450): void {
	const column = findColumn(columnId);
	if (!column) return;
	Object.assign(column, patch);
	openMenu = null;
	render();
	saveSoon(saveDelay);
}

function updateCard(columnId: string, cardId: string, patch: Partial<Card>, saveDelay = 450): void {
	const column = findColumn(columnId);
	if (!column) return;
	const card = findCard(column, cardId);
	if (!card) return;
	Object.assign(card, patch);
	openMenu = null;
	render();
	saveSoon(saveDelay);
}

function addColumn(): void {
	if (!board) return;

	openTextDialog('Add column', 'Column name', 'New column', 'Add', title => {
		if (!board) return;

		board.columns.push({
			id: uid('column'),
			title,
			body: '',
			color: DEFAULT_COLUMN_COLOR,
			icon: '',
			cards: [],
		});
		openMenu = null;
		render();
		saveSoon(0);
	});
}

function editColumn(columnId: string): void {
	const column = findColumn(columnId);
	if (!column) return;

	openTextDialog('Rename column', 'Column name', column.title, 'Save', title => {
		updateColumn(columnId, { title });
	});
}

function deleteColumn(columnId: string): void {
	if (!board) return;
	const column = findColumn(columnId);
	if (!column) return;

	if (column.cards.length > 0) {
		openConfirmDialog(
			'Delete column',
			'This column contains cards. Delete the column and all cards inside it?',
			'Delete column',
			true,
			() => deleteColumnNow(columnId),
		);
		return;
	}

	deleteColumnNow(columnId);
}

function deleteColumnNow(columnId: string): void {
	if (!board) return;

	board.columns = board.columns.filter(item => item.id !== columnId);
	openMenu = null;
	render();
	saveSoon(0);
}

function sortCards(columnId: string, direction: 'asc' | 'desc'): void {
	const column = findColumn(columnId);
	if (!column) return;

	const multiplier = direction === 'asc' ? 1 : -1;
	column.cards = column.cards
		.map((card, index) => ({ card, index }))
		.sort((left, right) => {
			const titleCompare = left.card.title.localeCompare(right.card.title, undefined, {
				numeric: true,
				sensitivity: 'base',
			});

			return titleCompare !== 0
				? titleCompare * multiplier
				: left.index - right.index;
		})
		.map(item => item.card);

	openMenu = null;
	render();
	saveSoon(0);
}

function addCard(columnId: string): void {
	const column = findColumn(columnId);
	if (!column) return;

	openTextDialog('Add task', 'Task text', 'New task', 'Add', title => {
		const targetColumn = findColumn(columnId);
		if (!targetColumn) return;

		targetColumn.cards.push({
			id: uid('card'),
			title,
			body: '',
			color: DEFAULT_CARD_COLOR,
			icon: '',
		});
		openMenu = null;
		render();
		saveSoon(0);
	});
}

function editCard(columnId: string, cardId: string): void {
	const column = findColumn(columnId);
	const card = column ? findCard(column, cardId) : undefined;
	if (!card) return;

	openTextDialog('Edit task', 'Task text', card.title, 'Save', title => {
		updateCard(columnId, cardId, { title });
	});
}

function editCardDetail(columnId: string, cardId: string): void {
	const column = findColumn(columnId);
	const card = column ? findCard(column, cardId) : undefined;
	if (!card) return;

	openMultilineDialog('Edit task detail', 'Task detail', card.body || '', 'Save', body => {
		updateCard(columnId, cardId, { body });
	});
}

function deleteCard(columnId: string, cardId: string): void {
	const column = findColumn(columnId);
	if (!column) return;
	column.cards = column.cards.filter(card => card.id !== cardId);
	openMenu = null;
	render();
	saveSoon(0);
}

function swatches(selectedColor: string, target: string, id: string): string {
	return COLOR_PALETTE.map(color => `
		<button
			class="swatch ${selectedColor === color.value ? 'is-selected' : ''}"
			type="button"
			data-action="set-color"
			data-target="${target}"
			data-id="${id}"
			data-color="${color.value}"
			title="${escapeHtml(color.label)}"
			style="background-color: ${color.value};"
		></button>
	`).join('');
}

function renderCardNote(body: string): string {
	const lines = body.split('\n').map(line => {
		return `<div class="card-note-line">${line ? escapeHtml(line) : '&nbsp;'}</div>`;
	});

	return `<div class="card-note">${lines.join('')}</div>`;
}

function renderColumnMenu(column: Column): string {
	const key = `column:${column.id}`;
	return `
		<div class="menu-popover ${isMenuOpen(key) ? '' : 'is-hidden'}" data-menu="${key}">
			<div class="menu-label">Column color</div>
			<div class="swatches">${swatches(column.color || DEFAULT_COLUMN_COLOR, 'column', column.id)}</div>
			<div class="menu-divider"></div>
			<button type="button" data-action="add-card" data-column-id="${column.id}">Add task</button>
			<button type="button" data-action="sort-cards-asc" data-column-id="${column.id}">Sort tasks A-Z</button>
			<button type="button" data-action="sort-cards-desc" data-column-id="${column.id}">Sort tasks Z-A</button>
			<div class="menu-divider"></div>
			<button type="button" data-action="edit-column" data-column-id="${column.id}">Rename</button>
			<button class="danger-text" type="button" data-action="delete-column" data-column-id="${column.id}">Delete column</button>
		</div>
	`;
}

function renderCardMenu(column: Column, card: Card): string {
	const key = `card:${column.id}:${card.id}`;
	return `
		<div class="menu-popover card-menu ${isMenuOpen(key) ? '' : 'is-hidden'}" data-menu="${key}">
			<div class="menu-label">Task color</div>
			<div class="swatches">${swatches(card.color || DEFAULT_CARD_COLOR, 'card', `${column.id}:${card.id}`)}</div>
			<div class="menu-divider"></div>
			<button type="button" data-action="edit-card" data-column-id="${column.id}" data-card-id="${card.id}">Edit task</button>
			<button type="button" data-action="edit-card-detail" data-column-id="${column.id}" data-card-id="${card.id}">Edit detail</button>
			<button class="danger-text" type="button" data-action="delete-card" data-column-id="${column.id}" data-card-id="${card.id}">Delete task</button>
		</div>
	`;
}

function renderCard(column: Column, card: Card): string {
	const body = card.body.trim();

	return `
		<article
			class="kanban-card"
			draggable="true"
			data-card-id="${card.id}"
			data-column-id="${column.id}"
			style="--card-color: ${card.color || DEFAULT_CARD_COLOR}"
		>
			<button class="card-menu-button" type="button" data-action="toggle-card-menu" data-column-id="${column.id}" data-card-id="${card.id}" title="Task options">⋯</button>
			<div class="card-text">
				<span class="card-title-text" data-action="edit-card" data-column-id="${column.id}" data-card-id="${card.id}">
					${escapeHtml(card.title)}
				</span>
			</div>
			${body ? renderCardNote(body) : ''}
			${renderCardMenu(column, card)}
		</article>
	`;
}

function renderColumn(column: Column): string {
	const cards = column.cards.map(card => renderCard(column, card)).join('');

	return `
		<section
			class="kanban-column"
			draggable="true"
			data-column-id="${column.id}"
			style="--column-color: ${column.color || DEFAULT_COLUMN_COLOR}"
		>
			<header class="column-header">
				<div class="column-title-row">
					<button class="column-title" type="button" data-action="edit-column" data-column-id="${column.id}" title="Rename column">
						${escapeHtml(column.title)}
					</button>
					<span class="column-count" title="Task count">${column.cards.length}</span>
					<button class="column-menu-button" type="button" data-action="toggle-column-menu" data-column-id="${column.id}" title="Column options">⋯</button>
				</div>
				${renderColumnMenu(column)}
			</header>
			<div class="card-list" data-drop-column-id="${column.id}">
				${cards || '<button class="empty-column" type="button" data-action="add-card" data-column-id="' + column.id + '">+ First task</button>'}
			</div>
		</section>
	`;
}

function renderEmptyState(message: string): void {
	if (!root) return;
	root.innerHTML = `
		<div class="empty-state">
			<div class="empty-title">JoplinKan</div>
			<div class="empty-copy">${escapeHtml(message)}</div>
		</div>
	`;
}

function renderDialog(): string {
	if (!dialogState) return '';

	if (dialogState.type === 'text' || dialogState.type === 'multiline') {
		const field = dialogState.type === 'text'
			? `<input
						id="joplinkan-dialog-input"
						class="dialog-input"
						data-role="dialog-input"
						type="text"
						value="${escapeHtml(dialogState.value)}"
					>`
			: `<textarea
						id="joplinkan-dialog-input"
						class="dialog-input dialog-textarea"
						data-role="dialog-input"
						rows="8"
					>${escapeHtml(dialogState.value)}</textarea>`;

		return `
			<div class="dialog-backdrop">
				<section class="dialog" role="dialog" aria-modal="true">
					<h2>${escapeHtml(dialogState.title)}</h2>
					<label class="field-label" for="joplinkan-dialog-input">${escapeHtml(dialogState.label)}</label>
					${field}
					<div class="dialog-actions">
						<button type="button" data-action="cancel-dialog">Cancel</button>
						<button class="primary-action" type="button" data-action="submit-text-dialog">${escapeHtml(dialogState.confirmLabel)}</button>
					</div>
				</section>
			</div>
		`;
	}

	return `
		<div class="dialog-backdrop">
			<section class="dialog" role="dialog" aria-modal="true">
				<h2>${escapeHtml(dialogState.title)}</h2>
				<p>${escapeHtml(dialogState.message)}</p>
				<div class="dialog-actions">
					<button type="button" data-action="cancel-dialog">Cancel</button>
					<button class="${dialogState.destructive ? 'danger-button' : 'primary-action'}" type="button" data-action="confirm-dialog">
						${escapeHtml(dialogState.confirmLabel)}
					</button>
				</div>
			</section>
		</div>
	`;
}

function render(): void {
	if (!root) return;

	const previousBoardElement = root.querySelector<HTMLElement>('.board');
	const previousBoardScrollLeft = previousBoardElement?.scrollLeft || 0;
	const previousCardListScroll = new Map<string, number>();
	root.querySelectorAll<HTMLElement>('.card-list').forEach(element => {
		const columnId = element.dataset.dropColumnId;
		if (columnId) previousCardListScroll.set(columnId, element.scrollTop);
	});

	if (!board) {
		renderEmptyState(emptyText || 'Open a note with a kanban-settings block to use this editor.');
		return;
	}

	root.innerHTML = `
		<div class="toolbar">
			<button class="primary-action" type="button" data-action="add-column">+ Column</button>
			<div class="icon-panel ${iconsExpanded ? 'is-expanded' : ''}">
				<div class="icon-strip" aria-label="Kanban icons">
					${visibleToolbarIcons().map(item => `
						<button class="icon-copy" type="button" data-action="copy-icon" data-icon="${escapeHtml(item.icon)}" title="Copy ${escapeHtml(item.label)}">
							${escapeHtml(item.icon)}
						</button>
					`).join('')}
				</div>
				<button class="icon-toggle" type="button" data-action="toggle-icons" title="${iconsExpanded ? 'Show fewer icons' : 'Show more icons'}">
					${iconsExpanded ? 'LESS' : 'MORE'}
				</button>
			</div>
			<div class="toolbar-spacer"></div>
			<div class="status" data-role="status">${escapeHtml(statusText)}</div>
		</div>
		<div class="error is-hidden" data-role="error"></div>
		<div class="board" data-note-id="${escapeHtml(noteId)}">
			${board.columns.map(renderColumn).join('')}
		</div>
		${renderDialog()}
	`;

	const boardElement = root.querySelector<HTMLElement>('.board');
	if (boardElement) boardElement.scrollLeft = previousBoardScrollLeft;
	root.querySelectorAll<HTMLElement>('.card-list').forEach(element => {
		const columnId = element.dataset.dropColumnId;
		const scrollTop = columnId ? previousCardListScroll.get(columnId) : undefined;
		if (typeof scrollTop === 'number') element.scrollTop = scrollTop;
	});

	renderStatus();
}

function toggleColumnMenu(columnId: string): void {
	const key = `column:${columnId}`;
	openMenu = isMenuOpen(key) ? null : { type: 'column', columnId };
	render();
}

function toggleCardMenu(columnId: string, cardId: string): void {
	const key = `card:${columnId}:${cardId}`;
	openMenu = isMenuOpen(key) ? null : { type: 'card', columnId, cardId };
	render();
}

async function handleClick(event: MouseEvent): Promise<void> {
	const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
	if (!target) {
		closeMenu();
		return;
	}

	const action = target.dataset.action;

	if (action === 'cancel-dialog') {
		closeDialog();
		return;
	}
	if (action === 'submit-text-dialog') {
		submitTextDialog();
		return;
	}
	if (action === 'confirm-dialog') {
		confirmDialog();
		return;
	}

	if (action === 'add-column') addColumn();
	if (action === 'toggle-icons') {
		iconsExpanded = !iconsExpanded;
		render();
	}
	if (action === 'copy-icon') {
		const icon = target.dataset.icon;
		if (icon) await copyText(icon);
	}
	if (action === 'add-card' && target.dataset.columnId) addCard(target.dataset.columnId);
	if (action === 'sort-cards-asc' && target.dataset.columnId) sortCards(target.dataset.columnId, 'asc');
	if (action === 'sort-cards-desc' && target.dataset.columnId) sortCards(target.dataset.columnId, 'desc');
	if (action === 'edit-column' && target.dataset.columnId) editColumn(target.dataset.columnId);
	if (action === 'delete-column' && target.dataset.columnId) deleteColumn(target.dataset.columnId);
	if (action === 'toggle-column-menu' && target.dataset.columnId) toggleColumnMenu(target.dataset.columnId);
	if (action === 'toggle-card-menu' && target.dataset.columnId && target.dataset.cardId) {
		toggleCardMenu(target.dataset.columnId, target.dataset.cardId);
	}
	if (action === 'edit-card' && target.dataset.columnId && target.dataset.cardId) {
		if (window.getSelection()?.toString()) return;
		editCard(target.dataset.columnId, target.dataset.cardId);
	}
	if (action === 'edit-card-detail' && target.dataset.columnId && target.dataset.cardId) {
		editCardDetail(target.dataset.columnId, target.dataset.cardId);
	}
	if (action === 'delete-card' && target.dataset.columnId && target.dataset.cardId) {
		deleteCard(target.dataset.columnId, target.dataset.cardId);
	}

	if (action === 'set-color') {
		const color = target.dataset.color;
		const id = target.dataset.id;
		if (!color || !id) return;

		if (target.dataset.target === 'column') {
			updateColumn(id, { color }, 0);
		}

		if (target.dataset.target === 'card') {
			const [columnId, cardId] = id.split(':');
			updateCard(columnId, cardId, { color }, 0);
		}
	}
}

function setupDragAndDrop(): void {
	if (!root) return;

	root.addEventListener('mousedown', event => {
		const target = event.target as HTMLElement;
		suppressTextDrag = !!target.closest('.card-title-text, .card-note, .menu-popover, button, input, textarea');
	});

	root.addEventListener('dragstart', event => {
		const cardElement = (event.target as HTMLElement).closest<HTMLElement>('.kanban-card');
		if (cardElement) {
			if (suppressTextDrag) {
				event.preventDefault();
				return;
			}

			dragState = {
				type: 'card',
				cardId: cardElement.dataset.cardId || '',
				fromColumnId: cardElement.dataset.columnId || '',
			};
			event.dataTransfer?.setData('text/plain', dragState.cardId);
			cardElement.classList.add('is-dragging');
			openMenu = null;
			return;
		}

		const columnElement = (event.target as HTMLElement).closest<HTMLElement>('.kanban-column');
		if (!columnElement) return;

		dragState = {
			type: 'column',
			columnId: columnElement.dataset.columnId || '',
		};
		event.dataTransfer?.setData('text/plain', dragState.columnId);
		columnElement.classList.add('is-dragging-column');
		openMenu = null;
	});

	root.addEventListener('dragend', event => {
		const cardElement = (event.target as HTMLElement).closest<HTMLElement>('.kanban-card');
		cardElement?.classList.remove('is-dragging');
		const columnElement = (event.target as HTMLElement).closest<HTMLElement>('.kanban-column');
		columnElement?.classList.remove('is-dragging-column');
		dragState = null;
	});

	root.addEventListener('dragover', event => {
		if ((event.target as HTMLElement).closest('.card-list, .kanban-card, .kanban-column, .board')) {
			event.preventDefault();
		}
	});

	root.addEventListener('drop', event => {
		if (dragState?.type === 'card') {
			const dropPosition = findDropPosition(event);
			if (dropPosition) {
				event.preventDefault();
				moveCard(dropPosition.columnId, dropPosition.beforeCardId);
			}
			return;
		}

		if (dragState?.type === 'column') {
			const dropPosition = findColumnDropPosition(event);
			if (!dropPosition) return;
			event.preventDefault();
			moveColumn(dropPosition.beforeColumnId);
		}
	});
}

function unwrapPluginMessage(eventOrMessage: PluginMessageEvent | PluginMessage): PluginMessage {
	if ('type' in eventOrMessage) return eventOrMessage;
	return eventOrMessage.message;
}

function applyPluginMessage(eventOrMessage: PluginMessageEvent | PluginMessage): void {
	const message = unwrapPluginMessage(eventOrMessage);

	if (message.type === 'board') {
		cancelPendingSave();
		board = cloneBoard(message.board);
		noteId = message.noteId;
		openMenu = null;
		dialogState = null;
		emptyText = '';
		errorText = '';
		statusText = '';
		render();
	}

	if (message.type === 'empty') {
		cancelPendingSave();
		board = null;
		noteId = '';
		openMenu = null;
		dialogState = null;
		emptyText = message.message;
		errorText = '';
		statusText = '';
		render();
	}

	if (message.type === 'error') {
		errorText = message.message;
		statusText = 'Error';

		if (!board) {
			renderEmptyState(errorText);
		} else {
			renderStatus();
		}
	}
}

async function start(): Promise<void> {
	if (!root) return;

	webviewApi.onMessage(applyPluginMessage);
	root.addEventListener('click', handleClick);
	document.addEventListener('keydown', event => {
		if (event.key === 'Escape') {
			if (dialogState) {
				closeDialog();
				return;
			}
			closeMenu();
		}

		if (
			event.key === 'Enter'
			&& (dialogState?.type === 'text' || (dialogState?.type === 'multiline' && (event.ctrlKey || event.metaKey)))
		) {
			submitTextDialog();
		}
	});
	setupDragAndDrop();

	const initial = await webviewApi.postMessage({ type: 'ready' }) as PluginMessage | { ok?: boolean };
	if ('type' in initial) {
		applyPluginMessage(initial);
	} else {
		render();
	}
}

start();
