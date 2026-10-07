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
  addedAt: number;
  syncedAt: number;
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

export interface Settings {
  notifications: boolean;
  haptics: boolean;
  /** Optional TMDB v3 key or v4 read token: richer film data, backdrops and release dates. */
  tmdbKey: string;
  appearance: 'system' | 'light' | 'dark';
  /** Sequels and titles from the same universe in the calendar. */
  related: boolean;
}
