import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FeedPost as TitlePost, FeedTitle as SharedTitle, buildFeed } from '../lib/feed';

const title = (id: number): SharedTitle => ({ id, kind: 'movie', keys: [`k:${id}`], route: `r${id}`, title: `T${id}` });
const post = (id: number, user: string, t: number, episode: number, at: number): TitlePost => ({ id, user, title: t, episode, body: 'x', at, reactions: {} });
const members = { a: { id: 'a', name: 'Ana', joinedAt: 0 }, b: { id: 'b', name: 'Bo', joinedAt: 0 } };
const titles = { 1: title(1), 2: title(2), 3: title(3) };
const DAY = 86_400_000;

test('ratings without words gather per person and day; reviewed titles are not repeated', () => {
  const feed = buildFeed({
    members,
    titles,
    ratings: [
      { user: 'a', title: 1, rating: 8, at: 10 * DAY },
      { user: 'a', title: 2, rating: 6, at: 10 * DAY + 5 },
      { user: 'a', title: 3, rating: 9, at: 12 * DAY },
    ],
    reviews: [post(7, 'a', 3, 0, 12 * DAY + 1)],
    talk: [],
  });
  assert.deepEqual(
    feed.map((f) => f.type),
    ['review', 'rated'],
  );
  const rated = feed[1];
  assert.equal(rated.type === 'rated' && rated.items.length, 2);
  assert.equal(feed[0].type === 'review' && feed[0].rating, 9);
});

test('posts from unknown members or titles are left out, latest first', () => {
  const feed = buildFeed({ members, titles, ratings: [], reviews: [], talk: [post(1, 'b', 1, 5, 2), post(2, 'z', 1, 5, 3), post(3, 'a', 9, 5, 4), post(4, 'a', 2, 5, 5)] });
  assert.deepEqual(
    feed.map((f) => f.key),
    ['t4', 't1'],
  );
});
