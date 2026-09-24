require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { detailPresentation, restoreDetailIndent } = require('../src/webview/detailPresentation.ts');
const { parseBoard } = require('../src/markdown/parseBoard.ts');
const { serializeBoard } = require('../src/markdown/serializeBoard.ts');
test('view/edit hides the common indent, nested bullets keep their relative depth', () => {
 const body = '  - first\n  - second\n    - child\n\n  - third';
 const view = detailPresentation(body);
 assert.equal(view.text, '- first\n- second\n  - child\n\n- third');
 assert.equal(restoreDetailIndent(view.text, view.prefix), body);
});
test('editing visible bullets preserves Markdown containment and source indent', () => {
 const md = '# Work\n- Task\n    - first\n    - second\n      - nested\n\n```kanban-settings\nversion: 1\nplugin: joplinkan\n```\n';
 const board = parseBoard(md), card = board.columns[0].cards[0];
 const view = detailPresentation(card.body);
 card.body = restoreDetailIndent(view.text + '\n- third', view.prefix);
 const serialized = serializeBoard(board);
 assert.match(serialized, /\n    - first\n    - second\n      - nested\n    - third\n/);
 assert.equal(parseBoard(serialized).columns[0].cards.length, 1);
});
test('tabs, no indent and intentional nested code are retained', () => {
 for (const body of ['\t- one\n\t\t- child', '- one\n  - child', '    code\n      deeper']) {
  const view = detailPresentation(body);
  assert.equal(restoreDetailIndent(view.text, view.prefix), body);
 }
});
