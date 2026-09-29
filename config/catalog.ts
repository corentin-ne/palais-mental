/**
 * Where searches look. Each collection queries its sources in parallel; the order is
 * also the ranking (the first source's result wins, later ones fill missing covers and
 * years). Remove a source to stop using it, reorder to change who wins.
 */
import type { CategoryId } from '../lib/types';

export type SourceId =
  | 'itunes'
  | 'imdb'
  | 'jikan'
  | 'wikidata'
  | 'wikipedia'
  | 'tvmaze'
  | 'deezer'
  | 'musicbrainz'
  | 'googlebooks'
  | 'openlibrary'
  | 'applebooks'
  | 'gutendex'
  | 'steam'
  | 'gog'
  | 'bgg';

export const CATALOG_SOURCES: Record<CategoryId, SourceId[]> = {
  movies: ['itunes', 'imdb', 'jikan', 'wikidata', 'wikipedia'],
  series: ['tvmaze', 'imdb', 'itunes', 'jikan', 'wikidata'],
  music: ['itunes', 'deezer', 'musicbrainz', 'wikipedia'],
  books: ['googlebooks', 'openlibrary', 'applebooks', 'jikan', 'gutendex', 'wikidata'],
  videogames: ['steam', 'gog', 'imdb', 'wikipedia', 'wikidata'],
  boardgames: ['bgg', 'wikipedia', 'wikidata'],
};

export const CATALOG = {
  /** Results asked of each source. */
  perSource: 10,
  /** Results shown per collection in a single-collection search, and in "Everything". */
  perCategory: 14,
  perCategoryInAll: 4,
  /** How long an identical request is served from memory (ms). */
  cacheTtl: 5 * 60_000,
  /** Background artwork lookup: wait this long before retrying a title that had none (ms). */
  coverRetryAfter: 3 * 86_400_000,
} as const;
