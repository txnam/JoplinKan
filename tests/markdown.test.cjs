require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseBoard, isKanbanMarkdown } = require('../src/markdown/parseBoard.ts');
const { serializeBoard } = require('../src/markdown/serializeBoard.ts');
const settings = '\n```kanban-settings\nversion: 1\nplugin: joplinkan\ncustom: keep me\n# comment\n```\n';
test('detail indentation survives five round trips', () => {
  const body = '- one\n- two\n  - nested\n- [ ] three\n\n1. numbered\n\tcode tab\n    indented code\n```js\n# literal\n~~~\n```';
  let md = '# Work\n- Task\n' + body.split('\n').map(l => '  ' + l).join('\n') + settings;
  for (let i = 0; i < 5; i++) {
    const board = parseBoard(md);
    assert.equal(board.columns[0].cards[0].body, body);
    md = serializeBoard(board);
  }
});
test('indented first line and legacy H2 preserve whitespace', () => {
  let board = parseBoard('# Work\n## Task\n    first\n    second\n    third' + settings);
  for (let i = 0; i < 5; i++) {
    assert.equal(board.columns[0].cards[0].body, '    first\n    second\n    third');
    board = parseBoard(serializeBoard(board));
  }
});
test('unknown markers, settings and surrounding content survive', () => {
  const md = '  intro\n\n# Work\n- Task [[project]]' + settings + '\n  outro\n';
  const output = serializeBoard(parseBoard(md));
  assert.match(output, /Task \[\[project\]\]/);
  assert.match(output, /custom: keep me\n# comment/);
  assert.ok(output.startsWith('  intro'));
  assert.match(output, /  outro\n$/);
});
test('settings fences inside code are ignored', () => {
  const sample = '````md\n```kanban-settings\nversion: 9\n```\n````\n';
  assert.equal(isKanbanMarkdown(sample), false);
  assert.equal(parseBoard(sample + '# Work\n- Task' + settings).columns.length, 1);
});
test('unsupported version rejected and configured colors applied', () => {
  assert.throws(() => parseBoard('# Work' + settings.replace('version: 1', 'version: 2')), /version/i);
  const board = parseBoard('# Work\n- Task' + settings.replace('custom: keep me', 'defaultCardColor: "#ff0000"\ndefaultColumnColor: "#0000ff"'));
  assert.equal(board.columns[0].color, '#0000ff');
  assert.equal(board.columns[0].cards[0].color, '#ff0000');
  board.columns[0].cards[0].color = '#ffffff';
  assert.equal(parseBoard(serializeBoard(board)).columns[0].cards[0].color, '#ffffff');
});
