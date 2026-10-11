import { test } from 'node:test';
import assert from 'node:assert/strict';

import { countsOf, statsOf, yearsOf } from '../lib/stats';
import type { Book, Game, Movie, Show } from '../lib/types';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 21).getTime();

const show: Show = {
  id: 's1',
  tvmazeId: 7,
  title: 'Severance',
  genres: ['Drama', 'Thriller'],
  runtime: 50,
  rating: 9,
  episodes: [
    { id: 1, season: 1, number: 1, name: 'a', runtime: 60 },
    { id: 2, season: 1, number: 2, name: 'b' },
    { id: 3, season: 1, number: 3, name: 'c' },
  ],
  watched: { 1: day(2025, 12, 31), 2: day(2026, 1, 1), 3: day(2026, 1, 2) },
  addedAt: 0,
  syncedAt: 0,
};
const lib = {
  shows: { s1: show },
  movies: {
    a: { id: 'a', title: 'Alien', genres: ['Thriller'], runtime: 117, watchedAt: day(2026, 1, 3), rating: 8 } as Movie,
    b: { id: 'b', title: 'Brazil', genres: ['Comedy'], rating: 6 } as Movie,
  },
  books: { d: { id: 'd', title: 'Dune', pages: 600, finishedAt: day(2026, 3, 10), rating: 9 } as Book },
  games: { h: { id: 'h', title: 'Hades', genres: ['Roguelike'], finishedAt: day(2024, 6, 1) } as Game },
};

test('years with something marked, latest first', () => {
  assert.deepEqual(yearsOf(lib), [2026, 2025, 2024]);
  assert.deepEqual(yearsOf({ shows: {}, movies: {}, books: {}, games: {} }), []);
});

test('a year counts only what was marked in it', () => {
  const s = statsOf(lib, 2026);
  assert.equal(s.episodes, 2);
  assert.equal(s.showMinutes, 100);
  assert.equal(s.films, 1);
  assert.equal(s.filmMinutes, 117);
  assert.equal(s.books, 1);
  assert.equal(s.pages, 600);
  assert.equal(s.games, 0);
  assert.equal(s.buckets.length, 12);
  assert.deepEqual(s.buckets[0], { at: 0, show: 2, movie: 1, book: 0, game: 0 });
  assert.equal(s.buckets[2].book, 1);
  assert.deepEqual(s.genres, [
    { name: 'Thriller', count: 2 },
    { name: 'Drama', count: 1 },
  ]);
  // Brazil is rated but not watched: left out of the year.
  assert.deepEqual(s.ratings, [0, 0, 0, 0, 0, 0, 0, 1, 2, 0]);
  assert.equal(s.activeDays, 4);
  assert.equal(s.streak, 3);
  assert.deepEqual(s.topShows.map((x) => [x.show.title, x.episodes]), [['Severance', 2]]);
  assert.deepEqual(countsOf(lib, 2026), { show: 2, movie: 1, book: 1, game: 0 });
});

test('all time: a bar per year, every rating, streaks across new year', () => {
  const s = statsOf(lib);
  assert.equal(s.episodes, 3);
  assert.equal(s.showMinutes, 160);
  assert.equal(s.games, 1);
  assert.deepEqual(s.buckets.map((b) => b.at), [2024, 2025, 2026]);
  assert.equal(s.buckets[0].game, 1);
  assert.equal(s.buckets[1].show, 1);
  assert.equal(s.ratings[5], 1);
  assert.equal(s.average, 8);
  assert.equal(s.streak, 4);
});

test('an empty library has no bars and no average', () => {
  const s = statsOf({ shows: {}, movies: {}, books: {}, games: {} });
  assert.deepEqual(s.buckets, []);
  assert.equal(s.average, undefined);
  assert.equal(s.streak, 0);
});
