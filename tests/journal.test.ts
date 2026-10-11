import { test } from 'node:test';
import assert from 'node:assert/strict';

import { journalEntries } from '../lib/journal';
import type { Book, Game, Movie, Show } from '../lib/types';

const t = (key: string) => key;

test('journal gathers episode notes and reviews of every kind, latest first', () => {
  const show: Show = {
    id: 's1',
    tvmazeId: 7,
    title: 'Severance',
    genres: [],
    episodes: [{ id: 70, season: 1, number: 2, name: 'Half Loop' }],
    watched: {},
    notes: { 70: { rating: 8, text: 'Eerie', at: 10 } },
    review: 'Great',
    reviewedAt: 20,
    addedAt: 0,
    syncedAt: 0,
  };
  const movie = { id: 'imdb-1', title: 'Alien', poster: 'p', review: 'Tense', reviewedAt: 40, addedAt: 0 } as Movie;
  const book = { id: 'ol-1', title: 'Dune', cover: 'c', review: 'Vast', reviewedAt: 30, addedAt: 0 } as Book;
  const game = { id: 'steam-1', title: 'Hades', addedAt: 0 } as Game;
  const entries = journalEntries({ shows: { s1: show }, movies: { m: movie }, books: { b: book }, games: { g: game } }, t);

  assert.deepEqual(entries.map((e) => e.title), ['Alien', 'Dune', 'Severance', 'Severance']);
  assert.equal(entries[0].href, '/movie/imdb-1');
  assert.equal(entries[1].poster, 'c');
  assert.equal(entries[2].detail, 'journal.review.show');
  assert.equal(entries[3].detail, 'S01E02 · Half Loop');
  assert.equal(entries[3].episode, true);
});
