require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { COLOR_GROUPS, COLOR_PALETTE } = require('../src/markdown/palette.ts');
test('68 unique colors, standard group first, Extra excludes near duplicates', () => {
 assert.equal(COLOR_GROUPS[0].label, 'Standard');
 assert.equal(COLOR_PALETTE.length, 68);
 assert.equal(new Set(COLOR_PALETTE.map(c => c.value.toLowerCase())).size, 68);
 for (const c of COLOR_PALETTE) assert.match(c.value, /^#[0-9a-f]{6}$/);
 assert.equal(COLOR_GROUPS[0].items.find(c => c.label === 'Dark Blue').value, '#00008b');
 assert.equal(COLOR_GROUPS[1].label, 'Extra');
 assert.deepEqual(COLOR_GROUPS[1].items.map(c => c.value), '#393e46 #64748b #eeeeee #ffffff #00adb5 #3abef9 #95e1d3 #16a34a #a3e635 #a8df8e #f9b572 #ff6b6b #ff4d6d #f875aa #c23373 #7c3aed #a78bfa #ffd6a5 #fff3da #e9c46a'.split(' '));
});
