import { test } from 'node:test';
import assert from 'node:assert/strict';

import { seasonHint, stripSeason } from '../lib/sources/seasons';
import { usernameFrom } from '../lib/sources/username';

test('a username is found in whatever was pasted', () => {
  assert.equal(usernameFrom('letterboxd', '@lea'), 'lea');
  assert.equal(usernameFrom('letterboxd', 'https://letterboxd.com/lea/films/'), 'lea');
  assert.equal(usernameFrom('letterboxd', 'https://boxd.it/abcd'), 'https://boxd.it/abcd');
  assert.equal(usernameFrom('serializd', 'serializd.com/user/tom/profile'), 'tom');
  assert.equal(usernameFrom('mal', 'https://myanimelist.net/profile/Kira?x=1'), 'Kira');
  assert.equal(usernameFrom('anilist', 'https://anilist.co/user/Mio/'), 'Mio');
  assert.equal(usernameFrom('trakt', 'https://trakt.tv/users/sam/history'), 'sam');
  assert.equal(usernameFrom('goodreads', 'https://www.goodreads.com/user/show/12345-lea'), '12345');
  assert.equal(usernameFrom('openlibrary', 'https://openlibrary.org/people/lea/books'), 'lea');
  assert.equal(usernameFrom('steam', '  https://steamcommunity.com/id/lea  '), 'https://steamcommunity.com/id/lea');
});

test('season numbers written into titles', () => {
  assert.equal(seasonHint('Attack on Titan Season 3'), 3);
  assert.equal(seasonHint('Mob Psycho 100 2nd Season'), 2);
  assert.equal(seasonHint('Lupin Saison 2'), 2);
  assert.equal(seasonHint('Severance'), undefined);
  assert.equal(stripSeason('Attack on Titan Season 3'), 'Attack on Titan');
  assert.equal(stripSeason('Mob Psycho 100 2nd Season'), 'Mob Psycho 100');
});
