/** A tracked episode. Specials are left out; `airstamp` is absent while the date is unknown. */
export interface Episode {
  id: number;
  season: number;
  number: number;
  name: string;
  airstamp?: number;
  runtime?: number;
  image?: string;
}

/** A series followed through TVmaze. */
export interface Show {
  id: string;
  tvmazeId: number;
  title: string;
  poster?: string;
  backdrop?: string;
  year?: number;
  network?: string;
  /** TVmaze status: Running, Ended, To Be Determined, In Development. */
  status?: string;
  genres: string[];
  summary?: string;
  runtime?: number;
  imdbId?: string;
  episodes: Episode[];
  /** Episode id → when it was marked watched (ms). */
  watched: Record<string, number>;
  /** Dropped shows stay in the library but leave Up next and the calendar. */
  droppedAt?: number;
  /** Your rating, 1–10 (half stars). */
  rating?: number;
  /** What you thought of the series as a whole. */
  review?: string;
  reviewedAt?: number;
  /** Episode id → your rating and note on that episode. */
  notes?: Record<string, EpisodeNote>;
  addedAt: number;
  syncedAt: number;
}

/** A private note on one episode: a rating, a few words, or both. */
export interface EpisodeNote {
  /** 1–10 (half stars). */
  rating?: number;
  text?: string;
  /** Last time it changed. */
  at: number;
}

/** Where a film's metadata comes from. TMDB when a key is set, else keyless sources. */
export type MovieSource = 'tmdb' | 'imdb' | 'itunes';

export interface Movie {
  /** `${source}-${sourceId}`, also the route parameter. */
  id: string;
  source: MovieSource;
  sourceId: string;
  title: string;
  poster?: string;
  backdrop?: string;
  year?: number;
  /** Release date (ms). In the future → shown in the calendar and notified. */
  releaseDate?: number;
  runtime?: number;
  overview?: string;
  genres: string[];
  director?: string;
  imdbId?: string;
  watchedAt?: number;
  /** Your rating, 1–10 (half stars). */
  rating?: number;
  addedAt: number;
  syncedAt: number;
}

export type ShowState = 'watching' | 'notStarted' | 'upToDate' | 'finished' | 'dropped';

/** Everything the library holds, for posters and routes. */
export type MediaKind = 'show' | 'movie' | 'book' | 'game';

/** Where a book comes from: Open Library, Google Books or Wikidata (all keyless). */
export type BookSource = 'ol' | 'gb' | 'wd';

/** A previous or next entry, or the series a book or game belongs to (Wikidata). */
export interface SeriesInfo {
  name: string;
  /** Position in the series ("3", "1.5"). */
  ordinal?: string;
}

export interface Book {
  /** `${source}-${sourceId}`, also the route parameter. */
  id: string;
  source: BookSource;
  sourceId: string;
  title: string;
  authors: string[];
  cover?: string;
  year?: number;
  /** Publication date (ms). In the future → shown in the calendar and notified. */
  releaseDate?: number;
  pages?: number;
  overview?: string;
  subjects: string[];
  isbn?: string;
  wikidataId?: string;
  series?: SeriesInfo;
  /** The page you are at. */
  page?: number;
  /** Last time the page changed. */
  touchedAt?: number;
  startedAt?: number;
  finishedAt?: number;
  droppedAt?: number;
  /** Your rating, 1–10 (half stars). */
  rating?: number;
  addedAt: number;
  syncedAt: number;
}

/** Where a game comes from: the Steam store or Wikidata (keyless). */
export type GameSource = 'steam' | 'wd';

export interface Game {
  id: string;
  source: GameSource;
  sourceId: string;
  title: string;
  cover?: string;
  backdrop?: string;
  year?: number;
  releaseDate?: number;
  developer?: string;
  platforms: string[];
  genres: string[];
  overview?: string;
  steamId?: string;
  wikidataId?: string;
  series?: SeriesInfo;
  /** Hours played. */
  hours?: number;
  /** How far you are, 0–100. */
  percent?: number;
  /** Last time the progress changed. */
  touchedAt?: number;
  startedAt?: number;
  finishedAt?: number;
  droppedAt?: number;
  rating?: number;
  addedAt: number;
  syncedAt: number;
}

/** Books and games: on your list, started, finished or dropped; `upcoming` while not out. */
export type ShelfState = 'started' | 'want' | 'upcoming' | 'finished' | 'dropped';

export interface Settings {
  notifications: boolean;
  haptics: boolean;
  /** Optional TMDB v3 key or v4 read token: richer film data, backdrops and release dates. */
  tmdbKey: string;
  appearance: 'system' | 'light' | 'dark';
  /** Sequels and titles from the same universe in the calendar. */
  related: boolean;
}
