require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const MarkdownIt = require('markdown-it');
const { createDefaultBoard } = require('../src/markdown/defaultBoard.ts');
const { parseBoard } = require('../src/markdown/parseBoard.ts');
const { serializeBoard } = require('../src/markdown/serializeBoard.ts');

function noteWithDetail(body) {
 const board = createDefaultBoard();
 board.columns = [board.columns[0]];
 board.columns[0].title = 'Work';
 board.columns[0].cards = [{ id: 'task', title: 'Task', body, color: '#ffffff', icon: '' }];
 return serializeBoard(board);
}
test('plain Enter renders as a break with either renderer setting, separate from title', () => {
 const md = noteWithDetail('Contact customer\nSend quotation\nMeet on Friday');
 for (const breaks of [false, true]) {
  const html = new MarkdownIt({ breaks }).render(md);
  assert.match(html, /<li>Task<br>\nContact customer<br>\nSend quotation<br>\nMeet on Friday<\/li>/);
 }
 assert.match(md, /- Task {2}\n  Contact customer {2}\n/);
 assert.doesNotMatch(md, /- Task[^\n]*\n\n/);
});
test('five saves do not accumulate whitespace and the edit model has no generated markers', () => {
 const body = 'one\ntwo\nthree\n\nA new paragraph\nlast line';
 let md = noteWithDetail(body);
 for (let i = 0; i < 5; i++) {
  const board = parseBoard(md);
  assert.equal(board.columns[0].cards[0].body, body);
  assert.equal(serializeBoard(board), md);
  md = serializeBoard(board);
 }
 assert.match(new MarkdownIt().render(md), /three<\/p>\n<p>A new paragraph<br>/);
});
test('lists and continuation paragraphs preserve nesting without extra breaks between items', () => {
 const body = '- first\n  continuation\n  - nested\n- second\n\n1. ordered\n2. another';
 const md = noteWithDetail(body), html = new MarkdownIt().render(md);
 assert.match(html, /first<br>\ncontinuation/);
 assert.doesNotMatch(html, /nested<br>|second<br>|ordered<br>/);
 assert.equal(parseBoard(md).columns[0].cards[0].body, body);
});
test('fenced/indented code, tables, HTML blocks and multiline inline code stay unchanged', () => {
 for (const body of [
  '```js\nconst a = 1;  \nconst b = 2;\n```',
  '    code one  \n    code two',
  '| A | B |\n| --- | --- |\n| one | two |\n| three | four |',
  '<pre>\none\ntwo  \n</pre>',
  'A `code\nspan` here\nNext line',
  '> quoted\n> continued',
 ]) {
  const md = noteWithDetail(body);
  assert.equal(parseBoard(md).columns[0].cards[0].body, body);
  const html = new MarkdownIt({ html: true }).render(md);
  if (body.startsWith('```') || body.startsWith('    ') || body.startsWith('|') || body.startsWith('<pre>')) assert.doesNotMatch(html, /<br>/);
  if (body.startsWith('A `')) assert.match(html, /<code>code span<\/code> here<br>\nNext line/);
 }
});
test('existing explicit breaks do not double and code trailing spaces are preserved', () => {
 const md = noteWithDetail('one  \ntwo<br>\nthree\\\nfour');
 const html = new MarkdownIt({ html: true }).render(md);
 assert.doesNotMatch(html, /<br>\s*<br>/);
 assert.equal((html.match(/<br>/g) || []).length, 4); // Title + three detail breaks.
});

test('bullets, ordered lists starting at one and fenced code need no blank separator', () => {
 for (const body of ['- first\n- second', '1. first\n2. second', '```js\nconst x = 1;\n```', '> quote', '### Heading\ntext']) {
  const md = noteWithDetail(body);
  assert.match(md, /- Task\n  /);
  assert.equal(parseBoard(md).columns[0].cards[0].body, body);
  const html = new MarkdownIt().render(md);
  if (body.startsWith('-')) assert.match(html, /<li>Task\n<ul>/);
  if (body.startsWith('1.')) assert.match(html, /<li>Task\n<ol>/);
  if (body.startsWith('```')) assert.match(html, /<pre><code class="language-js">const x = 1;/);
 }
});

test('necessary separators preserve code, tables, definitions and list numbering', () => {
 const cases = [
  ['    code one\n    code two', /<pre><code>code one\ncode two/],
  ['| A | B |\n| --- | --- |\n| x | y |', /<table>/],
  ['2. second\n3. third', /<ol start="2">/],
  ['[ref]: https://example.com\n\n[Link][ref]', /href="https:\/\/example.com"/],
  ['Heading\n---', /<h2>Heading<\/h2>/],
 ];
 for (const [body, expected] of cases) {
  const md = noteWithDetail(body);
  assert.match(md, /- Task\n\n/);
  assert.match(new MarkdownIt().render(md), expected);
  assert.equal(serializeBoard(parseBoard(md)), md);
 }
});

test('title colors and subsequent tasks survive compact detail round trips', () => {
 const board = createDefaultBoard();
 board.columns[0].cards[0].body = 'First line\nSecond line';
 const original = board.columns[0].cards[0];
 let md = serializeBoard(board);
 for (let i = 0; i < 5; i++) {
  const parsed = parseBoard(md);
  assert.equal(parsed.columns[0].cards.length, board.columns[0].cards.length);
  assert.equal(parsed.columns[0].cards[0].title, original.title);
  assert.equal(parsed.columns[0].cards[0].color, original.color);
  assert.equal(parsed.columns[0].cards[0].body, original.body);
  assert.equal(serializeBoard(parsed), md);
  md = serializeBoard(parsed);
 }
});
