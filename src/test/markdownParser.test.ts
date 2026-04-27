import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultBoard } from '../markdown/defaultBoard';
import { parseBoard } from '../markdown/parseBoard';
import { serializeBoard } from '../markdown/serializeBoard';

test('parse board có nhiều cột, card và màu', () => {
	const board = parseBoard(serializeBoard(createDefaultBoard()));

	assert.equal(board.columns.length, 3);
	assert.equal(board.columns[0].title, 'This week');
	assert.equal(board.columns[0].color, '#94a3b8');
	assert.equal(board.columns[0].cards[0].title, 'Prepare and send out client invoices');
	assert.equal(board.columns[0].cards[0].color, '#bfdbfe');
});

test('serialize metadata màu bằng marker ngắn, không ghi id hoặc icon', () => {
	const serialized = serializeBoard(createDefaultBoard());

	assert.match(serialized, /^# This week \[\[#94a3b8\]\]/m);
	assert.match(serialized, /^- Prepare and send out client invoices \[\[#bfdbfe\]\]/m);
	assert.doesNotMatch(serialized, /<!--/);
	assert.doesNotMatch(serialized, /kanban-column/);
	assert.doesNotMatch(serialized, /kanban-card/);
	assert.doesNotMatch(serialized, /id=/);
	assert.doesNotMatch(serialized, /icon=/);
});

test('parse marker màu markdown', () => {
	const markdown = [
		'# Backlog [[#cffafe]]',
		'',
		'- Task A [[yellow]]',
		'',
		'- Task B \\[color: #bfdbfe\\]',
		'',
		'```kanban-settings',
		'version: 1',
		'plugin: joplinkan',
		'```',
		'',
	].join('\n');

	const board = parseBoard(markdown);
	assert.equal(board.columns[0].color, '#cffafe');
	assert.equal(board.columns[0].cards[0].color, '#ca8a04');
	assert.equal(board.columns[0].cards[1].title, 'Task B');
	assert.equal(board.columns[0].cards[1].color, '#bfdbfe');
});

test('giữ description nhiều dòng, list và code fence', () => {
	const markdown = [
		'# Backlog <!-- kanban-column:id=backlog;color=#64748b;icon=📥 -->',
		'',
		'- Task <!-- kanban-card:id=task-1;color=#ffffff;icon= -->',
		'  - Dòng 1',
		'  - Dòng 2',
		'',
		'  ```ts',
		'  # không phải heading',
		'  const value = 1;',
		'  ```',
		'',
		'```kanban-settings',
		'version: 1',
		'plugin: joplinkan',
		'defaultColumnColor: "#64748b"',
		'defaultCardColor: "#ffffff"',
		'```',
		'',
	].join('\n');

	const board = parseBoard(markdown);
	assert.match(board.columns[0].cards[0].body, /# không phải heading/);
	assert.match(serializeBoard(board), /  ```ts\n  # không phải heading/);
});

test('metadata bị xóa vẫn không làm mất nội dung', () => {
	const markdown = [
		'# Việc cần làm',
		'',
		'- Viết tài liệu',
		'',
		'Nội dung task.',
		'',
		'```kanban-settings',
		'version: 1',
		'plugin: joplinkan',
		'```',
		'',
	].join('\n');

	const board = parseBoard(markdown);
	assert.equal(board.columns[0].title, 'Việc cần làm');
	assert.equal(board.columns[0].cards[0].title, 'Viết tài liệu');
	assert.equal(board.columns[0].cards[0].body, 'Nội dung task.');
	const serialized = serializeBoard(board);
	assert.match(serialized, /\[\[#ffffff\]\]/);
	assert.doesNotMatch(serialized, /kanban-card:id=/);
});

test('giữ bullet cùng cấp trong phần nội dung phụ của task', () => {
	const markdown = [
		'# Backlog <!-- kanban-column:id=backlog;color=#64748b;icon= -->',
		'',
		'- Task có nội dung phụ <!-- kanban-card:id=task-1;color=#ffffff;icon= -->',
		'  - việc A',
		'  - việc B',
		'',
		'```kanban-settings',
		'version: 1',
		'plugin: joplinkan',
		'```',
		'',
	].join('\n');

	const serialized = serializeBoard(parseBoard(markdown));

	assert.match(serialized, /  - việc A\n  - việc B/);
	assert.doesNotMatch(serialized, /  - việc A\n    - việc B/);
});

test('đọc được format H2 cũ và serialize về list item mới', () => {
	const markdown = [
		'# Backlog <!-- kanban-column:id=backlog;color=#64748b;icon=📥 -->',
		'',
		'## Viết tài liệu <!-- kanban-card:id=task-1;color=#ffffff;icon=📚 -->',
		'',
		'- checklist cũ',
		'- ghi chú cũ',
		'',
		'```kanban-settings',
		'version: 1',
		'plugin: joplinkan',
		'```',
		'',
	].join('\n');

	const board = parseBoard(markdown);
	const serialized = serializeBoard(board);

	assert.equal(board.columns[0].cards[0].title, 'Viết tài liệu');
	assert.match(board.columns[0].cards[0].body, /checklist cũ/);
	assert.match(serialized, /^- Viết tài liệu \[\[#ffffff\]\]/m);
	assert.doesNotMatch(serialized, /^## /m);
});

test('serialize rồi parse lại cho kết quả tương đương', () => {
	const first = createDefaultBoard();
	const serialized = serializeBoard(first);
	const second = parseBoard(serialized);
	const serializedAgain = serializeBoard(second);

	assert.equal(serializedAgain, serialized);
});
