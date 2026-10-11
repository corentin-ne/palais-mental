import { test } from 'node:test';
import assert from 'node:assert/strict';

import { WrittenLists, episodesKey, joinLibrary, splitLibrary } from '../lib/libraryParts';
import type { Episode } from '../lib/types';

const ep = (id: number): Episode => ({ id, season: 1, number: id, name: `E${id}` });
const library = (shows: Record<string, { episodes: Episode[]; syncedAt: number; title?: string }>) => ({ state: { shows, movies: {} }, version: 4 });

test('episode lists leave the main value, each under its own key', () => {
  const written: WrittenLists = new Map();
  const a = [ep(1), ep(2)];
  const { main, lists, removed } = splitLibrary(library({ a: { episodes: a, syncedAt: 5, title: 'A' } }), written);
  assert.deepEqual(main.state.shows.a, { episodes: [], syncedAt: 5, title: 'A' });
  assert.deepEqual(lists, [['a', a]]);
  assert.deepEqual(removed, []);
  assert.equal(episodesKey('lib', 'a'), 'lib/episodes/a');
});

test('only lists that changed are written again, and a removed show takes its list with it', () => {
  const a = [ep(1)];
  const b = [ep(2)];
  const written: WrittenLists = new Map([
    ['a', a],
    ['gone', [ep(9)]],
  ]);
  const { lists, removed } = splitLibrary(library({ a: { episodes: a, syncedAt: 1 }, b: { episodes: b, syncedAt: 1 } }), written);
  assert.deepEqual(lists, [['b', b]]);
  assert.deepEqual(removed, ['gone']);
});

test('reading puts the lists back and remembers them', () => {
  const written: WrittenLists = new Map();
  const list = [ep(1)];
  const value = joinLibrary(library({ a: { episodes: [], syncedAt: 7 } }), { a: list }, written);
  assert.equal(value.state.shows.a.episodes, list);
  assert.equal(value.state.shows.a.syncedAt, 7);
  assert.equal(written.get('a'), list);
  // Nothing to write again until the list changes.
  assert.deepEqual(splitLibrary(value, written).lists, []);
});

test('a library saved before 1.8 keeps its lists, moved out on the next write', () => {
  const written: WrittenLists = new Map();
  const old = [ep(1), ep(2)];
  const value = joinLibrary(library({ a: { episodes: old, syncedAt: 7 } }), {}, written);
  assert.equal(value.state.shows.a.episodes, old);
  assert.equal(value.state.shows.a.syncedAt, 7);
  assert.deepEqual(splitLibrary(value, written).lists, [['a', old]]);
});

test('a list that went missing is asked for again', () => {
  const value = joinLibrary(library({ a: { episodes: [], syncedAt: 7 } }), {}, new Map());
  assert.deepEqual(value.state.shows.a, { episodes: [], syncedAt: 0 });
});
