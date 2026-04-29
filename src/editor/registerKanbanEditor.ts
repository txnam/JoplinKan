import joplin from 'api';
import { ViewHandle } from 'api/types';
import { isKanbanMarkdown, parseBoard } from '../markdown/parseBoard';
import { serializeBoard } from '../markdown/serializeBoard';
import { Board } from '../markdown/types';

type EditorState = {
	noteId: string;
	board: Board;
	body: string;
};

type ViewContext = {
	state: EditorState | null;
	ready: boolean;
	updateSequence: number;
};

type WebviewMessage =
	| { type: 'ready' }
	| { type: 'saveBoard'; noteId: string; board: Board };

const EDITOR_VIEW_ID = 'joplinkan-board-editor';
const viewContexts = new Map<ViewHandle, ViewContext>();

function editorHtml(): string {
	return '<!doctype html>\n' +
		'<html>\n' +
		'<head>\n' +
		'<meta charset="utf-8">\n' +
		'<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
		'</head>\n' +
		'<body>\n' +
		'<div id="app" class="app-shell">\n' +
		'<div class="loading">Loading Kanban board...</div>\n' +
		'</div>\n' +
		'</body>\n' +
		'</html>';
}

function contextFor(handle: ViewHandle): ViewContext {
	let context = viewContexts.get(handle);
	if (!context) {
		context = {
			state: null,
			ready: false,
			updateSequence: 0,
		};
		viewContexts.set(handle, context);
	}

	return context;
}

async function loadNoteBody(noteId: string): Promise<string> {
	const note = await joplin.data.get(['notes', noteId], { fields: ['id', 'body'] });
	return typeof note.body === 'string' ? note.body : '';
}

function createEditorState(noteId: string, body: string): EditorState {
	return {
		noteId,
		board: parseBoard(body),
		body,
	};
}

function postBoard(handle: ViewHandle, state: EditorState): void {
	joplin.views.editors.postMessage(handle, {
		type: 'board',
		noteId: state.noteId,
		board: state.board,
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

function setContextState(handle: ViewHandle, state: EditorState, notify = true): void {
	const context = contextFor(handle);
	context.state = state;
	if (notify && context.ready) postBoard(handle, state);
}

function clearContextState(handle: ViewHandle, message: string): void {
	const context = contextFor(handle);
	context.state = null;
	if (context.ready) postEmpty(handle, message);
}

async function updateViewFromBody(handle: ViewHandle, noteId: string, body: string): Promise<boolean> {
	const context = contextFor(handle);
	const sequence = ++context.updateSequence;

	try {
		if (context.state?.noteId === noteId && context.state.body === body) {
			return true;
		}

		if (!isKanbanMarkdown(body)) {
			if (sequence === context.updateSequence) {
				clearContextState(handle, 'The current note is not a Kanban board.');
			}
			return false;
		}

		const state = createEditorState(noteId, body);
		if (sequence !== context.updateSequence) {
			return true;
		}

		setContextState(handle, state);
		return true;
	} catch (error) {
		if (sequence === context.updateSequence) {
			context.state = null;
			if (context.ready) {
				const message = error instanceof Error ? error.message : 'Could not read the Kanban board.';
				postError(handle, message);
			}
		}

		return false;
	}
}

async function handleWebviewMessage(handle: ViewHandle, message: WebviewMessage): Promise<unknown> {
	if (!message || typeof message !== 'object') return { ok: false };

	if (message.type === 'ready') {
		const context = contextFor(handle);
		context.ready = true;

		const state = context.state;
		return state ? { ok: true, type: 'board', noteId: state.noteId, board: state.board } : { ok: true };
	}

	if (message.type === 'saveBoard') {
		const state = contextFor(handle).state;
		if (!state) return { ok: true };

		if (message.noteId !== state.noteId) {
			return { ok: true };
		}

		const body = serializeBoard({
			...message.board,
			preamble: state.board.preamble,
			epilogue: state.board.epilogue,
		});

		await joplin.views.editors.saveNote(handle, {
			noteId: state.noteId,
			body,
		});

		setContextState(handle, createEditorState(state.noteId, body), false);
		return { ok: true };
	}

	return { ok: false };
}

async function setupKanbanEditor(handle: ViewHandle): Promise<void> {
	const editors = joplin.views.editors;
	contextFor(handle);

	await editors.setHtml(handle, editorHtml());
	await editors.addScript(handle, './webview/styles.css');

	await editors.onUpdate(handle, async event => {
		if (!event.noteId) {
			clearContextState(handle, 'No note is selected.');
			return;
		}

		await updateViewFromBody(handle, event.noteId, event.newBody);
	});

	await editors.onMessage(handle, async (message: WebviewMessage) => {
		return handleWebviewMessage(handle, message);
	});

	await editors.addScript(handle, './webview/app.js');
}

export async function registerKanbanEditor(): Promise<void> {
	await joplin.views.editors.register(EDITOR_VIEW_ID, {
		onActivationCheck: async event => {
			if (!event.noteId) return false;

			const body = await loadNoteBody(event.noteId);
			return isKanbanMarkdown(body);
		},
		onSetup: setupKanbanEditor,
	});
}
