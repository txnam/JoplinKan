require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

test('editor keeps drafts across note changes and exposes conflict recovery', async () => {
 const base = '# Work\n- Task\n\n```kanban-settings\nversion: 1\nplugin: joplinkan\n```\n';
 const notes = { a: { body: base, title: 'A', parent_id: 'folder' }, b: { body: base, title: 'B', parent_id: 'folder' } };
 const handlers = {}, updates = {}, events = []; let callbacks;
 const mock = { views: { editors: {
  register: async (_, value) => { callbacks = value; }, setHtml: async () => {}, addScript: async () => {},
  onMessage: async (h, cb) => { handlers[h] = cb; }, onUpdate: async (h, cb) => { updates[h] = cb; },
  postMessage: (handle, message) => events.push({ handle, message }),
  saveNote: async (_, { noteId, body }) => { notes[noteId].body = body; },
 } }, data: {
  get: async ([_, id]) => ({ ...notes[id] }),
  put: async ([_, id], __, props) => { Object.assign(notes[id], props); },
  post: async (_, __, props) => { notes.copy = props; return { id: 'copy' }; },
 } };
 const originalLoad = Module._load;
 Module._load = function(name, ...args) { return name === 'api' ? mock : originalLoad.call(this, name, ...args); };
 try { await require('../src/editor/registerKanbanEditor.ts').registerKanbanEditor(); }
 finally { Module._load = originalLoad; }
 await callbacks.onSetup('view');
 await updates.view({ noteId: 'a', newBody: base });
 const first = await handlers.view({ type: 'ready' });
 first.board.columns[0].cards[0].title = 'Changed A';
 await updates.view({ noteId: 'b', newBody: base });
 const request = { type: 'saveBoard', noteId: 'a', sessionId: first.sessionId, baseBody: first.baseBody, sequence: 1, board: first.board };
 assert.equal((await handlers.view(request)).ok, true);
 await new Promise(resolve => setImmediate(resolve));
 assert.match(notes.a.body, /Changed A/); assert.equal(notes.b.body, base);
 assert.equal((await handlers.view({ type: 'ready' })).noteId, 'b');
 assert.equal((await handlers.view({ ...request, sessionId: 'invalid' })).ok, false);
 await updates.view({ noteId: 'a', newBody: notes.a.body });
 const active = await handlers.view({ type: 'ready' });
 notes.a.body = base.replace('Task', 'External task');
 active.board.columns[0].cards[0].title = 'Unsaved draft';
 await handlers.view({ ...request, sequence: 2, board: active.board });
 await new Promise(resolve => setImmediate(resolve));
 assert.match(notes.a.body, /External task/);
 assert.equal(events.at(-1).message.status, 'conflict');
 assert.equal((await handlers.view({ ...request, type: 'saveCopy' })).ok, true);
 assert.match(notes.copy.body, /Unsaved draft/); assert.equal(notes.copy.parent_id, 'folder');
 await handlers.view({ ...request, type: 'reloadBoard' });
 const reloaded = await handlers.view({ type: 'ready' });
 assert.equal(reloaded.board.columns[0].cards[0].title, 'External task');
 assert.notEqual(reloaded.sessionId, first.sessionId);
 assert.equal((await handlers.view({ ...request, sequence: 3 })).ok, false);
});
