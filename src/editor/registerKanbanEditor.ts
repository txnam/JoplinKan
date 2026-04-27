import joplin from 'api';
import { ViewHandle } from 'api/types';
import { editorHtml } from './editorHtml';
import { isKanbanMarkdown, parseBoard } from '../markdown/parseBoard';
import { serializeBoard } from '../markdown/serializeBoard';
import { Board } from '../markdown/types';

type EditorState = {
	noteId: string;
	board: Board;
	body: string;
};

type WebviewMessage =
	| { type: 'ready' }
	| { type: 'saveBoard'; board: Board };

const EDITOR_VIEW_ID = 'joplinkan-board-editor';
const editorStates = new Map<ViewHandle, EditorState>();
const editorHandles = new Set<ViewHandle>();

async function loadNoteBody(noteId: string): Promise<string> {
	const note = await joplin.data.get(['notes', noteId], { fields: ['id', 'body'] });
	return typeof note.body === 'string' ? note.body : '';
}

function postBoard(handle: ViewHandle, noteId: string, board: Board): void {
	joplin.views.editors.postMessage(handle, {
		type: 'board',
		noteId,
		board,
	});
}

function postError(handle: ViewHandle, message: string): void {
	joplin.views.editors.postMessage(handle, {
		type: 'error',
		message,
	});
}

function postEmpty(handle: ViewHandle, message: string): void {
	joplin.views.editors.postMessage(handle, {
		type: 'empty',
		message,
	});
}

async function refreshFromBody(handle: ViewHandle, noteId: string, body: string): Promise<void> {
	try {
		const board = parseBoard(body);
		editorStates.set(handle, { noteId, board, body });
		postBoard(handle, noteId, board);
	} catch (error) {
		editorStates.delete(handle);
		postError(handle, error instanceof Error ? error.message : 'Could not read the Kanban board.');
	}
}

async function refreshHandleFromSelectedNote(handle: ViewHandle): Promise<void> {
	const note = await joplin.workspace.selectedNote();
	if (!note?.id) {
		editorStates.delete(handle);
		postEmpty(handle, 'No note is selected.');
		return;
	}

	const body = typeof note.body === 'string' ? note.body : await loadNoteBody(note.id);
	if (!isKanbanMarkdown(body)) {
		editorStates.delete(handle);
		postEmpty(handle, 'The current note is not a Kanban board.');
		return;
	}

	await refreshFromBody(handle, note.id, body);
}

async function handleWebviewMessage(handle: ViewHandle, message: WebviewMessage): Promise<unknown> {
	if (!message || typeof message !== 'object') return { ok: false };

	if (message.type === 'ready') {
		if (!editorStates.has(handle)) {
			await refreshHandleFromSelectedNote(handle);
		}

		const state = editorStates.get(handle);
		return state ? { ok: true, type: 'board', noteId: state.noteId, board: state.board } : { ok: true };
	}

	if (message.type === 'saveBoard') {
		const state = editorStates.get(handle);
		if (!state) return { ok: false, message: 'Could not find the current editor state.' };

		try {
			const body = serializeBoard({
				...message.board,
				preamble: state.board.preamble,
				epilogue: state.board.epilogue,
			});

			await joplin.views.editors.saveNote(handle, {
				noteId: state.noteId,
				body,
			});

			const board = parseBoard(body);
			editorStates.set(handle, { noteId: state.noteId, board, body });

			return { ok: true };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Could not save the Kanban board.';
			postError(handle, errorMessage);
			return { ok: false, message: errorMessage };
		}
	}

	return { ok: false };
}

export async function registerKanbanEditor(): Promise<void> {
	await joplin.workspace.onNoteSelectionChange(async event => {
		const noteId = event.value?.[0];
		if (!noteId) {
			for (const handle of editorHandles) {
				editorStates.delete(handle);
				postEmpty(handle, 'No note is selected.');
			}
			return;
		}

		const body = await loadNoteBody(noteId);
		for (const handle of editorHandles) {
			if (isKanbanMarkdown(body)) {
				await refreshFromBody(handle, noteId, body);
			} else {
				editorStates.delete(handle);
				postEmpty(handle, 'The current note is not a Kanban board.');
			}
		}
	});

	await joplin.workspace.onNoteChange(async event => {
		for (const [handle, state] of editorStates.entries()) {
			if (state.noteId !== event.id) continue;

			const body = await loadNoteBody(event.id);
			if (body !== state.body) {
				await refreshFromBody(handle, event.id, body);
			}
		}
	});

	await joplin.views.editors.register(EDITOR_VIEW_ID, {
		onActivationCheck: async event => {
			const body = await loadNoteBody(event.noteId);
			return isKanbanMarkdown(body);
		},

		onSetup: async handle => {
			editorHandles.add(handle);
			await joplin.views.editors.setHtml(handle, editorHtml());
			await joplin.views.editors.addScript(handle, './webview/styles.css');
			await joplin.views.editors.addScript(handle, './webview/app.js');

			await joplin.views.editors.onMessage(handle, async (message: WebviewMessage) => {
				return handleWebviewMessage(handle, message);
			});

			await joplin.views.editors.onUpdate(handle, async event => {
				await refreshFromBody(handle, event.noteId, event.newBody);
			});
		},
	});
}
