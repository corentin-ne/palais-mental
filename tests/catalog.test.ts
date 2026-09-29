import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CatalogResult,
  Fetcher,
  commonsImage,
  imdbArt,
  mergeResults,
  parseBggImage,
  parseBggSearch,
  parseGog,
  parseGutendex,
  parseImdb,
  parseItunesBooks,
  parseJikan,
  parseWikidataEntities,
  parseWikidataSearch,
  personName,
  pickCover,
  searchCategory,
} from '../lib/catalog';

const IMDB = {
  d: [
    { i: { imageUrl: 'https://m.media-amazon.com/images/M/abc._V1_.jpg' }, id: 'tt1160419', l: 'Dune', qid: 'movie', s: 'Timothée Chalamet, Rebecca Ferguson', y: 2021 },
    { i: { imageUrl: 'https://m.media-amazon.com/images/M/def._V1_.jpg' }, id: 'tt0142032', l: 'Dune', qid: 'tvMiniSeries', s: 'William Hurt', y: 2000 },
    { id: 'tt2064627', l: 'Dune II', qid: 'videoGame', y: 1992 },
    { id: 'nm0001', l: 'Frank Herbert', s: 'Writer' },
  ],
};

test('IMDb suggestions split by kind and upsize posters', () => {
  const movies = parseImdb(IMDB, 'movies');
  assert.equal(movies.length, 1);
  assert.equal(movies[0].creator, 'Timothée Chalamet');
  assert.equal(movies[0].coverUrl, 'https://m.media-amazon.com/images/M/abc._V1_QL75_UX600_.jpg');
  assert.equal(parseImdb(IMDB, 'series')[0].year, 2000);
  assert.equal(parseImdb(IMDB, 'videogames')[0].title, 'Dune II');
  assert.equal(imdbArt('https://x/y._V1_UX67_CR0,0,67,98_AL_.jpg'), 'https://x/y._V1_QL75_UX600_.jpg');
});

const JIKAN_ANIME = {
  data: [
    {
      mal_id: 52991,
      title: 'Sousou no Frieren',
      title_english: "Frieren: Beyond Journey's End",
      type: 'TV',
      episodes: 28,
      year: 2023,
      aired: { from: '2023-09-29T00:00:00+00:00' },
      studios: [{ name: 'Madhouse' }],
      images: { jpg: { large_image_url: 'https://cdn.myanimelist.net/images/anime/1015/138006l.jpg' } },
    },
    { mal_id: 1, title: 'Frieren Movie', type: 'Movie', images: { jpg: { image_url: 'https://cdn/x.jpg' } } },
  ],
};

test('Jikan anime go to series or films, manga to books', () => {
  const series = parseJikan(JIKAN_ANIME, 'series');
  assert.equal(series.length, 1);
  assert.equal(series[0].title, "Frieren: Beyond Journey's End");
  assert.equal(series[0].episodeCount, 28);
  assert.equal(series[0].creator, 'Madhouse');
  assert.equal(parseJikan(JIKAN_ANIME, 'movies')[0].coverUrl, 'https://cdn/x.jpg');
  const manga = parseJikan(
    { data: [{ mal_id: 2, title: 'Berserk', type: 'Manga', authors: [{ name: 'Miura, Kentarou' }], published: { from: '1989-08-25T00:00:00+00:00' } }] },
    'books',
  );
  assert.equal(manga[0].creator, 'Kentarou Miura');
  assert.equal(manga[0].year, 1989);
});

test('GOG, Gutendex and Apple Books', () => {
  const gog = parseGog({ products: [{ id: '1207664663', title: 'The Witcher 3', releaseDate: '2015.05.18', developers: ['CD PROJEKT RED'], coverVertical: 'http://images.gog-statics.com/a.jpg' }] });
  assert.deepEqual([gog[0].year, gog[0].creator, gog[0].coverUrl], [2015, 'CD PROJEKT RED', 'https://images.gog-statics.com/a.jpg']);

  const pg = parseGutendex({ results: [{ id: 345, title: 'Dracula', authors: [{ name: 'Stoker, Bram' }], formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/345/pg345.cover.medium.jpg' } }] });
  assert.equal(pg[0].creator, 'Bram Stoker');
  assert.ok(pg[0].coverUrl?.endsWith('.jpg'));

  const ebooks = parseItunesBooks({ results: [{ trackId: 9, trackName: 'Dune', artistName: 'Frank Herbert', releaseDate: '1965-08-01T07:00:00Z', artworkUrl100: 'https://a/100x100bb.jpg' }] });
  assert.equal(ebooks[0].coverUrl, 'https://a/600x600bb.jpg');
  assert.equal(ebooks[0].year, 1965);
  assert.equal(personName('Herbert'), 'Herbert');
});

test('BoardGameGeek search and artwork', () => {
  const games = parseBggSearch({ items: [{ objectid: '13', name: 'CATAN', yearpublished: 1995, subtype: 'boardgame' }, { objectid: '9', name: 'Expansion', subtype: 'boardgameexpansion' }] });
  assert.equal(games.length, 1);
  assert.equal(games[0].year, 1995);
  assert.equal(parseBggImage({ item: { imageurl: 'https://cf.geekdo-images.com/pic.jpg' } }), 'https://cf.geekdo-images.com/pic.jpg');
  assert.equal(parseBggImage({}), undefined);
});

test('Wikidata keeps only the right kind of work and resolves Commons images', () => {
  const search = {
    search: [
      { id: 'Q17004', label: 'Catan', description: 'board game designed by Klaus Teuber' },
      { id: 'Q1', label: 'Catan', description: 'fictional island' },
    ],
  };
  const hits = parseWikidataSearch(search, 'boardgames');
  assert.deepEqual(hits.map((h) => h.id), ['Q17004']);
  const results = parseWikidataEntities(
    { entities: { Q17004: { claims: { P18: [{ mainsnak: { datavalue: { value: 'Catan box.jpg' } } }], P577: [{ mainsnak: { datavalue: { value: { time: '+1995-00-00T00:00:00Z' } } } }] } } } },
    hits,
    'boardgames',
  );
  assert.equal(results[0].coverUrl, commonsImage('Catan box.jpg'));
  assert.equal(results[0].year, 1995);
  assert.ok(results[0].coverUrl?.includes('Catan_box.jpg'));
});

test('merge fills a missing cover from a later source', () => {
  const a: CatalogResult = { key: 'a', category: 'boardgames', title: 'Catan', source: { provider: 'bgg', id: '13' } };
  const b: CatalogResult = { key: 'b', category: 'boardgames', title: 'CATAN', coverUrl: 'https://x/c.jpg', source: { provider: 'wikipedia', id: '1' } };
  const merged = mergeResults([[a], [b]]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].coverUrl, 'https://x/c.jpg');
});

test('pickCover prefers an exact title, then the creator', () => {
  const r = (title: string, creator: string, coverUrl?: string): CatalogResult => ({ key: title + creator, category: 'books', title, creator, coverUrl, source: { provider: 'manual', id: '' } });
  const list = [r('Dune Messiah', 'Frank Herbert', 'm'), r('Dune', 'Someone', 's'), r('Dune', 'Frank Herbert', 'h'), r('Dune', 'X')];
  assert.equal(pickCover(list, 'Dune', 'Frank Herbert'), 'h');
  assert.equal(pickCover(list, 'dune'), 's');
  assert.equal(pickCover(list, 'Nothing'), undefined);
});

test('one failing provider never breaks a search', async () => {
  const fetcher: Fetcher = async (url) => {
    if (url.includes('boardgamegeek')) throw new Error('offline');
    if (url.includes('wikidata')) return { search: [] };
    return { query: { pages: { 1: { pageid: 1, title: 'Catan', index: 1, thumbnail: { source: 'https://x/c.jpg' } } } } };
  };
  const results = await searchCategory('boardgames', 'catan', { lang: 'en', fetcher });
  assert.equal(results[0].title, 'Catan');
  assert.equal(results[0].coverUrl, 'https://x/c.jpg');
});
