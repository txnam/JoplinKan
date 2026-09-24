require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SaveCoordinator } = require('../src/editor/saveCoordinator.ts');
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
test('slow writes keep the newest change and serialize by note', async () => {
 let body = 'base'; const gate = deferred(); const entered = deferred(); const writes = []; const results = [];
 const saver = new SaveCoordinator(async () => body, async (_, next) => { writes.push(next); entered.resolve(); if (writes.length === 1) await gate.promise; body = next; }, r => results.push(r));
 const session = saver.open('a', body);
 saver.submit(session.id, 1, 'base', 'first'); await entered.promise;
 saver.submit(session.id, 2, 'base', 'second'); saver.submit(session.id, 3, 'base', 'latest');
 gate.resolve(); await saver.settled('a');
 assert.equal(body, 'latest'); assert.deepEqual(writes, ['first', 'latest']);
 assert.equal(results.at(-1).sequence, 3); assert.equal(results.at(-1).status, 'saved');
 assert.equal(saver.submit(session.id, 2, 'base', 'stale'), false);
});
test('two views cannot silently overwrite each other', async () => {
 let body = 'base'; const results = [];
 const saver = new SaveCoordinator(async () => body, async (_, next) => { body = next; }, r => results.push(r));
 const a = saver.open('note', body), b = saver.open('note', body);
 saver.submit(a.id, 1, 'base', 'a'); saver.submit(b.id, 1, 'base', 'b'); await saver.settled('note');
 assert.equal(body, 'a'); assert.equal(b.body, 'b'); assert.equal(b.status, 'conflict');
 assert.equal(saver.retry(b.id), false);
});
test('failure retains draft, retry saves it, different note proceeds independently', async () => {
 const notes = { a: 'base', b: 'base' }; let fail = true;
 const saver = new SaveCoordinator(async id => notes[id], async (session, body) => {
  if (session.noteId === 'a' && fail) throw Error('offline'); notes[session.noteId] = body;
 }, () => {});
 const a = saver.open('a', 'base'), b = saver.open('b', 'base');
 saver.submit(a.id, 1, 'base', 'draft a'); saver.submit(b.id, 1, 'base', 'draft b');
 await Promise.all([saver.settled('a'), saver.settled('b')]);
 assert.equal(a.status, 'error'); assert.equal(notes.b, 'draft b');
 fail = false; saver.retry(a.id); await saver.settled('a'); assert.equal(notes.a, 'draft a');
});
