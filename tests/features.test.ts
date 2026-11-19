import { test } from 'node:test';
import assert from 'node:assert/strict';

import { milestoneOf } from '../lib/milestoneRules';
import { bookPace, gamePace, showPace } from '../lib/pace';
import { recapOf, recapYear } from '../lib/recap';
import { fractionOf, scoresFrom } from '../lib/scoreParse';
import { countsOf, statsOf } from '../lib/stats';
import { ideasFor } from '../lib/tonight';
import type { Book, Game, Movie, Show } from '../lib/types';

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 19, 20).getTime();
const day = (y: number, m: number, d: number, h = 21) => new Date(y, m - 1, d, h).getTime();
const empty = { shows: {} as Record<string, Show>, movies: {} as Record<string, Movie>, books: {} as Record<string, Book>, games: {} as Record<string, Game> };

function makeShow(watched: Record<number, number>, status = 'Ended'): Show {
  return {
    id: 's1',
    tvmazeId: 7,
    title: 'Severance',
    status,
    genres: ['Drama'],
    runtime: 50,
    episodes: [
      { id: 1, season: 1, number: 1, name: 'a', airstamp: NOW - 30 * DAY, runtime: 40 },
      { id: 2, season: 1, number: 2, name: 'b', airstamp: NOW - 29 * DAY },
      { id: 3, season: 2, number: 1, name: 'c', airstamp: NOW - 2 * DAY },
    ],
    watched,
    addedAt: 0,
    syncedAt: 0,
  };
}

// ------------------------------------------------------------------ Milestones
test('ticking the last episode of an ended show finishes it', () => {
  const before = { ...empty, shows: { s1: makeShow({ 1: NOW - DAY, 2: NOW - DAY }) } };
  const after = { ...empty, shows: { s1: makeShow({ 1: NOW - DAY, 2: NOW - DAY, 3: NOW }) } };
  assert.equal(milestoneOf(before, after, {}, NOW)?.kind, 'showFinished');
});

test('finishing a season of a show still running is a season moment', () => {
  const before = { ...empty, shows: { s1: makeShow({ 1: NOW - DAY }, 'Running') } };
  const after = { ...empty, shows: { s1: makeShow({ 1: NOW - DAY, 2: NOW }, 'Running') } };
  const m = milestoneOf(before, after, {}, NOW);
  assert.equal(m?.kind, 'seasonDone');
  assert.equal(m?.kind === 'seasonDone' && m.season, 1);
});

test('a refresh that only replaces metadata celebrates nothing', () => {
  const show = makeShow({ 1: NOW - DAY, 2: NOW - DAY, 3: NOW - DAY }, 'Running');
  const before = { ...empty, shows: { s1: show } };
  const after = { ...empty, shows: { s1: { ...show, status: 'Ended' } } };
  assert.equal(milestoneOf(before, after, {}, NOW), undefined);
});

test('reaching a goal wins over finishing the book that reached it', () => {
  const book = (finishedAt?: number) => ({ id: 'b', title: 'Dune', finishedAt }) as Book;
  const other = { id: 'c', title: 'Emma', finishedAt: NOW - 5 * DAY } as Book;
  const before = { ...empty, books: { b: book(), c: other } };
  const after = { ...empty, books: { b: book(NOW), c: other } };
  assert.deepEqual(milestoneOf(before, after, { book: 2 }, NOW), { kind: 'goal', stat: 'book', count: 2, year: 2026 });
  assert.equal(milestoneOf(before, after, { book: 5 }, NOW)?.kind, 'bookFinished');
});

test('an import (many changes, or old dates) is not a moment', () => {
  const books = (at?: number) => Object.fromEntries(['a', 'b', 'c', 'd'].map((id) => [id, { id, title: id, finishedAt: at } as Book]));
  assert.equal(milestoneOf({ ...empty, books: books() }, { ...empty, books: books(NOW) }, {}, NOW), undefined);
  const one = (at?: number) => ({ a: { id: 'a', title: 'a', finishedAt: at } as Book });
  assert.equal(milestoneOf({ ...empty, books: one() }, { ...empty, books: one(NOW - 10 * DAY) }, {}, NOW), undefined);
});

// ------------------------------------------------------------------ Pace
test('a show: minutes left from each episode, a finish date from your recent pace', () => {
  const show = makeShow({ 1: NOW - 6 * DAY }, 'Running');
  const lone = showPace(show, NOW)!;
  assert.equal(lone.left, 100);
  assert.equal(lone.finishAt, undefined);
  const busy = { ...makeShow({ 1: NOW - 6 * DAY, 2: NOW - 5 * DAY }, 'Running'), episodes: [...show.episodes, { id: 4, season: 2, number: 2, name: 'd', airstamp: NOW - DAY }] };
  const p = showPace(busy, NOW)!;
  assert.equal(p.left, 100);
  // Two episodes over a week (the shortest window): one episode every 3.5 days, two left → 7 days.
  assert.equal(p.finishAt, NOW + 7 * DAY);
});

test('a book: pages left and a finish at the pace since you started', () => {
  const b = { id: 'b', title: 'Dune', pages: 600, page: 100, startedAt: NOW - 10 * DAY } as Book;
  const p = bookPace(b, NOW)!;
  assert.equal(p.left, 500);
  assert.equal(p.finishAt, NOW + 50 * DAY);
  assert.equal(bookPace({ ...b, finishedAt: NOW }, NOW), undefined);
});

test('a game: hours left from the usual playtime', () => {
  const g = { id: 'g', title: 'Hades', hours: 10, startedAt: NOW - 5 * DAY } as Game;
  const p = gamePace(g, 22, NOW)!;
  assert.equal(p.left, 12);
  assert.equal(p.finishAt, NOW + 6 * DAY);
  assert.equal(gamePace(g, undefined, NOW), undefined);
  assert.equal(gamePace({ ...g, hours: 30 }, 22, NOW), undefined);
});

// ------------------------------------------------------------------ Tonight
test('tonight: only what fits, the show you are in first', () => {
  const lib = {
    ...empty,
    shows: { s1: makeShow({ 1: NOW - DAY }, 'Running') },
    movies: {
      short: { id: 'short', title: 'Short', runtime: 85, genres: [] } as unknown as Movie,
      long: { id: 'long', title: 'Long', runtime: 190, genres: [] } as unknown as Movie,
    },
  };
  const fixed = () => 0;
  const hour = ideasFor(lib, 60, NOW, fixed);
  assert.deepEqual(
    hour.map((i) => i.key),
    ['show:s1'],
  );
  assert.equal(hour[0].what.key, 'tonight.episode');
  const evening = ideasFor(lib, 120, NOW, fixed);
  assert.deepEqual(evening.map((i) => i.key).sort(), ['movie:short', 'show:s1']);
  // Two episodes left, room for two.
  assert.deepEqual(evening.find((i) => i.kind === 'show')?.what, { key: 'tonight.episodes', params: { count: 2, from: 'S01E02' } });
  assert.equal(ideasFor(lib, Infinity, NOW, fixed).length, 3);
});

// ------------------------------------------------------------------ Rewatches
test('watching or reading again counts each time', () => {
  const lib = {
    ...empty,
    movies: { a: { id: 'a', title: 'Alien', genres: [] as string[], runtime: 100, watchedAt: day(2026, 5, 1), history: [day(2026, 2, 1), day(2020, 1, 1)] } as Movie },
    books: { d: { id: 'd', title: 'Dune', pages: 600, finishedAt: day(2026, 3, 10), history: [day(2026, 1, 10)] } as Book },
  };
  const s = statsOf(lib, 2026);
  assert.equal(s.films, 2);
  assert.equal(s.filmMinutes, 200);
  assert.equal(s.books, 2);
  assert.equal(s.pages, 1200);
  assert.deepEqual(countsOf(lib, 2026), { show: 0, movie: 2, book: 2, game: 0 });
  assert.equal(statsOf(lib).films, 3);
});

// ------------------------------------------------------------------ Recap
test('recap: totals, best-rated, the biggest binge and goals', () => {
  const show = {
    ...makeShow({ 1: day(2026, 3, 1, 20), 2: day(2026, 3, 1, 21), 3: day(2026, 4, 2) }),
    rating: 9,
  };
  const lib = {
    ...empty,
    shows: { s1: show },
    movies: { a: { id: 'a', title: 'Alien', genres: [] as string[], runtime: 117, watchedAt: day(2026, 3, 1), rating: 10 } as Movie },
    games: { h: { id: 'h', title: 'Hades', genres: [] as string[], platforms: [] as string[], finishedAt: day(2026, 6, 1), hours: 20 } as Game },
  };
  const r = recapOf(lib, 2026, { movie: 10 });
  assert.equal(r.titles, 3);
  assert.equal(r.minutes, 40 + 50 + 50 + 117 + 20 * 60);
  assert.deepEqual(r.top.map((x) => x.title), ['Alien', 'Severance']);
  assert.equal(r.binge?.episodes, 2);
  assert.equal(r.busiest?.count, 3);
  assert.equal(r.bestMonth, 2);
  assert.deepEqual(r.goals, [{ kind: 'movie', goal: 10, count: 1 }]);
  assert.equal(recapOf(empty, 2026).titles, 0);
});

test('the recap is offered from mid-November to January', () => {
  assert.equal(recapYear(new Date(2026, 10, 14).getTime()), undefined);
  assert.equal(recapYear(new Date(2026, 10, 15).getTime()), 2026);
  assert.equal(recapYear(new Date(2026, 11, 31).getTime()), 2026);
  assert.equal(recapYear(new Date(2027, 0, 20).getTime()), 2026);
  assert.equal(recapYear(new Date(2027, 1, 1).getTime()), undefined);
});

// ------------------------------------------------------------------ Critic scores
test('review scores read from Wikidata, one per site', () => {
  const claim = (value: string, by: string, method?: string) => ({
    mainsnak: { datavalue: { value } },
    qualifiers: { P447: [{ datavalue: { value: { id: by } } }], ...(method ? { P459: [{ datavalue: { value: { id: method } } }] } : {}) },
  });
  const scores = scoresFrom({ P444: [claim('8.4/10', 'Q105584', 'Q108403540'), claim('93%', 'Q105584'), claim('7.9/10', 'Q105584'), claim('81/100', 'Q150248'), claim('8.1/10', 'Q37312'), claim('5/5', 'Q1')] });
  assert.deepEqual(
    scores.map((s) => [s.source, s.value]),
    [
      ['rt', '93%'],
      ['mc', '81/100'],
      ['imdb', '8.1/10'],
    ],
  );
  assert.equal(fractionOf('93%'), 0.93);
  assert.ok(Math.abs(fractionOf('8.1/10')! - 0.81) < 1e-9);
  assert.equal(fractionOf('A+'), undefined);
});
