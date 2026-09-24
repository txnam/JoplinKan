import joplin from 'api';
import { ViewHandle } from 'api/types';
import { isKanbanMarkdown, parseBoard } from '../markdown/parseBoard';
import { serializeBoard } from '../markdown/serializeBoard';
import { Board } from '../markdown/types';
import { SaveCoordinator, SaveSession } from './saveCoordinator';

type EditorState = { noteId: string; board: Board; session: SaveSession; initialBody: string };
type ViewContext = { state: EditorState | null; ready: boolean; drafts: Map<string, EditorState> };
type WebviewMessage = { type: string; noteId?: string; sessionId?: string; sequence?: number; baseBody?: string; board?: Board };
const EDITOR_VIEW_ID = 'joplinkan-board-editor';
const contexts = new Map<ViewHandle, ViewContext>();
const owners = new Map<string, ViewHandle>();
const sessions = new Map<string, EditorState>();
const saver = new SaveCoordinator(loadNoteBody, async (session, body) => {
 const handle = owners.get(session.id);
 if (!handle) throw new Error('The editor session is no longer available.');
 if (contextFor(handle).state?.session.id === session.id) {
  await joplin.views.editors.saveNote(handle, { noteId: session.noteId, body });
 } else {
  // A queued write can outlive selection. saveNote only accepts current/recent notes.
  await joplin.data.put(['notes', session.noteId], null, { body });
 }
}, result => {
 const handle = owners.get(result.sessionId);
 if (handle && contextFor(handle).ready) joplin.views.editors.postMessage(handle, { type: 'saveStatus', ...result });
});

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
 let context = contexts.get(handle);
 if (!context) { context = { state: null, ready: false, drafts: new Map() }; contexts.set(handle, context); }
 return context;
}
async function loadNoteBody(noteId: string): Promise<string> {
 const note = await joplin.data.get(['notes', noteId], { fields: ['id', 'body'] });
 return typeof note.body === 'string' ? note.body : '';
}
function boardMessage(state: EditorState): object {
 return { type: 'board', noteId: state.noteId, board: state.board, sessionId: state.session.id,
  baseBody: state.initialBody, sequence: state.session.sequence, status: state.session.status, message: state.session.message };
}
function send(handle: ViewHandle, message: object): void {
 if (contextFor(handle).ready) joplin.views.editors.postMessage(handle, message);
}
async function updateViewFromBody(handle: ViewHandle, noteId: string, body: string, force = false): Promise<void> {
 const context = contextFor(handle);
 const existing = context.drafts.get(noteId);
 const dirty = existing && (existing.session.pending || existing.session.savedSequence < existing.session.sequence);
 if (!force && existing && (dirty || existing.session.baseBody === body)) {
  const changed = context.state !== existing;
  context.state = existing;
  if (changed) send(handle, boardMessage(existing));
  return;
 }
 try {
  if (!isKanbanMarkdown(body)) {
   context.state = null;
   send(handle, { type: 'empty', noteId, discardDraft: force, message: 'The current note is not a Kanban board.' });
   return;
  }
  const board = parseBoard(body);
  const session = saver.open(noteId, body);
  owners.set(session.id, handle);
  const state = { noteId, board, session, initialBody: body };
  sessions.set(session.id, state);
  context.drafts.set(noteId, state); context.state = state;
  send(handle, { ...boardMessage(state), discardDraft: force });
 } catch (error) {
  context.state = null;
  send(handle, { type: 'empty', noteId, discardDraft: force, message: error instanceof Error ? error.message : 'Could not read the Kanban board.' });
 }
}
async function handleWebviewMessage(handle: ViewHandle, message: WebviewMessage): Promise<unknown> {
 if (!message || typeof message !== 'object') return { ok: false, message: 'Invalid message.' };
 const context = contextFor(handle);
 if (message.type === 'ready') {
  context.ready = true;
  return context.state ? { ok: true, ...boardMessage(context.state) } : { ok: true };
 }
 const state = message.sessionId ? sessions.get(message.sessionId) : undefined;
 if (!state || state.noteId !== message.noteId || owners.get(state.session.id) !== handle) return { ok: false, message: 'Unknown or expired editing session.' };
 try {
  if (message.type === 'saveBoard') {
   if (!message.board || !Array.isArray(message.board.columns) || typeof message.baseBody !== 'string' || message.baseBody !== state.initialBody) {
    return { ok: false, message: 'Invalid board or content revision.' };
   }
   const board = { ...message.board, preamble: state.board.preamble, epilogue: state.board.epilogue,
    extraSettingsLines: state.board.extraSettingsLines };
   const body = serializeBoard(board);
   const ok = saver.submit(state.session.id, message.sequence!, message.baseBody, body);
   if (ok) {
    state.board = board;
    context.drafts.set(state.noteId, state);
    if (context.state?.noteId === state.noteId) context.state = state;
   }
   return { ok, status: ok ? 'accepted' : 'error', message: ok ? undefined : 'Stale save request.' };
  }
  if (message.type === 'retrySave') return { ok: saver.retry(state.session.id) };
  if (message.type === 'reloadBoard') {
   await saver.settled(state.noteId);
   const body = await loadNoteBody(state.noteId);
   if (context.state === state) {
    await updateViewFromBody(handle, state.noteId, body, true);
    sessions.delete(state.session.id);
   }
   return { ok: true };
  }
  if (message.type === 'saveCopy') {
   const note = await joplin.data.get(['notes', state.noteId], { fields: ['title', 'parent_id'] });
   const copy = await joplin.data.post(['notes'], null, { title: `${note.title} (Kanban copy)`, parent_id: note.parent_id,
    body: serializeBoard(state.board) });
   return { ok: true, noteId: copy.id };
  }
  return { ok: false, message: 'Unknown action.' };
 } catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'Could not complete the action.' }; }
}
async function setupKanbanEditor(handle: ViewHandle): Promise<void> {
 const editors = joplin.views.editors;
 contextFor(handle);
 await editors.setHtml(handle, editorHtml());
 await editors.addScript(handle, './webview/styles.css');
 await editors.onUpdate(handle, async event => {
  if (!event.noteId) { contextFor(handle).state = null; send(handle, { type: 'empty', message: 'No note is selected.' }); return; }
  await updateViewFromBody(handle, event.noteId, event.newBody);
 });
 await editors.onMessage(handle, (message: WebviewMessage) => handleWebviewMessage(handle, message));
 await editors.addScript(handle, './webview/app.js');
}
export async function registerKanbanEditor(): Promise<void> {
 await joplin.views.editors.register(EDITOR_VIEW_ID, {
  onActivationCheck: async event => !!event.noteId && isKanbanMarkdown(await loadNoteBody(event.noteId)),
  onSetup: setupKanbanEditor,
 });
}
