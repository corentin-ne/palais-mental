import { test } from 'node:test';
import assert from 'node:assert/strict';

import { overflow, writtenAt } from '../lib/cacheBudget';

test('nothing is dropped while the cache fits', () => {
  assert.deepEqual(overflow({ a: [1, 100], b: [2, 100] }, 5, 1000), []);
});

test('the oldest entries go first, past the count or past the bytes', () => {
  assert.deepEqual(overflow({ a: [3, 10], b: [1, 10], c: [2, 10] }, 2, 1000), ['b']);
  assert.deepEqual(overflow({ a: [3, 400], b: [1, 400], c: [2, 400] }, 5, 500), ['b', 'c']);
});

test('entries written before sizes were kept still count', () => {
  assert.equal(writtenAt(7), 7);
  assert.equal(writtenAt([7, 100]), 7);
  assert.deepEqual(overflow({ old: 1, fresh: [2, 100] }, 5, 5000), ['old']);
});
