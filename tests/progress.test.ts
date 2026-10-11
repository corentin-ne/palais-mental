import { test } from 'node:test';
import assert from 'node:assert/strict';

import { episodeCode, progressOf, showState, sortEpisodes, upNextShows } from '../lib/progress';
import type { Episode, Show } from '../lib/types';

const NOW = 1_000_000;
const ep = (id: number, number: number, airstamp?: number): Episode => ({ id, season: 1, number, name: `E${number}`, airstamp });
const show = (patch: Partial<Show>): Show => ({
  id: 's',
  tvmazeId: 1,
  title: 'Show',
  genres: [],
  episodes: [ep(1, 1, 10), ep(2, 2, 20), ep(3, 3, 30), ep(4, 4, NOW + 100)],
  watched: {},
  addedAt: 0,
  syncedAt: 0,
  ...patch,
});

test('episodeCode pads season and number', () => {
  assert.equal(episodeCode({ season: 2, number: 5 }), 'S02E05');
});

test('picks up after the furthest watched episode, earlier gaps are skipped', () => {
  const p = progressOf(show({ watched: { 2: 1 } }), NOW);
  assert.equal(p.next?.id, 3);
  assert.deepEqual(p.skipped.map((e) => e.id), [1]);
  assert.equal(p.left, 1);
  assert.equal(p.upcoming?.id, 4);
});

test('show states follow progress', () => {
  assert.equal(showState(show({}), NOW), 'notStarted');
  assert.equal(showState(show({ watched: { 1: 1 } }), NOW), 'watching');
  assert.equal(showState(show({ watched: { 1: 1, 2: 1, 3: 1 } }), NOW), 'upToDate');
  assert.equal(showState(show({ watched: { 1: 1 }, droppedAt: 5 }), NOW), 'dropped');
  const ended = show({ status: 'Ended', episodes: [ep(1, 1, 10)], watched: { 1: 1 } });
  assert.equal(showState(ended, NOW), 'finished');
});

test('up next lists shows in progress, last touched first, with the episode to pick up', () => {
  const a = show({ id: 'a', watched: { 1: 5 } });
  const b = show({ id: 'b', watched: { 1: 9 } });
  const done = show({ id: 'c', watched: { 1: 1, 2: 1, 3: 1 } });
  const list = upNextShows({ a, b, c: done }, NOW);
  assert.deepEqual(list.map((s) => s.show.id), ['b', 'a']);
  assert.equal(list[0].next.id, 2);
  assert.equal(list[0].left, 2);
});

test('episodes out of order are sorted; a sorted list is returned as is', () => {
  const sorted = [ep(1, 1, 10), ep(2, 2, 20)];
  assert.equal(sortEpisodes(sorted), sorted);
  const mixed = [ep(2, 2, 20), ep(1, 1, 10)];
  assert.deepEqual(sortEpisodes(mixed).map((e) => e.id), [1, 2]);
  assert.deepEqual(mixed.map((e) => e.id), [2, 1]);
  assert.equal(progressOf(show({ episodes: mixed, watched: { 1: 1 } }), NOW).next?.id, 2);
});
