import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SHELF_STATES, bookFraction, clampPage, shelfState } from '../lib/shelf';

const NOW = 1_000_000;

test('shelf states, in order of precedence', () => {
  assert.equal(shelfState({}, NOW), 'want');
  assert.equal(shelfState({ releaseDate: NOW + 1 }, NOW), 'upcoming');
  assert.equal(shelfState({ startedAt: 1 }, NOW), 'started');
  assert.equal(shelfState({ page: 12 }, NOW), 'started');
  assert.equal(shelfState({ startedAt: 1, pausedAt: 2 }, NOW), 'paused');
  assert.equal(shelfState({ startedAt: 1, pausedAt: 2, finishedAt: 3 }, NOW), 'finished');
  assert.equal(shelfState({ finishedAt: 3, droppedAt: 4 }, NOW), 'dropped');
});

test('every state has a place in the library', () => {
  assert.deepEqual([...SHELF_STATES].sort(), ['dropped', 'finished', 'paused', 'started', 'upcoming', 'want']);
});

test('book fraction and page clamping', () => {
  assert.equal(bookFraction({ page: 50, pages: 200 }), 0.25);
  assert.equal(bookFraction({ finishedAt: 1 }), 1);
  assert.equal(clampPage(250, 200), 200);
  assert.equal(clampPage(-3), 0);
});
