export const CATEGORIES = ['movies', 'series', 'music', 'books', 'boardgames', 'videogames'] as const;
export type CategoryId = (typeof CATEGORIES)[number];

export interface BaseItem {
  id: string;
  category: CategoryId;
  title: string;
  createdAt: number;
  updatedAt?: number;
  /** Director, showrunner, artist, author, designer or studio — label depends on category. */
  creator?: string;
  year?: number;
  /** 0 (unrated) to 5, in half steps. */
  rating?: number;
  note?: string;
  /** Artwork from the catalog (poster, book cover, album art, box art). */
  coverUrl?: string;
  /** Where the metadata came from, so a second log of the same title is recognized. */
  source?: ItemSource;
  /** Most recent journal event touching this item. */
  lastLoggedAt?: number;
  /**
   * Hero Swap flag. `false` while the item is still owned by the HeroItemSpawner
   * (materializing / flying); the shelf InstancedMesh only renders settled items.
   */
  settled: boolean;
}

/** One season = one disc. `watched / episodeCount` is the disc's pie fraction. */
export interface Season {
  episodeCount: number;
  watched: number;
}

export interface SeriesItem extends BaseItem {
  category: 'series';
  /** Seasons before the first tracked one (a series logged from season 3 has offset 2). */
  seasonOffset?: number;
  seasons: Season[];
}

export interface StandardItem extends BaseItem {
  category: Exclude<CategoryId, 'series'>;
}

export type PalaceItem = SeriesItem | StandardItem;

/** A queued center-screen reward. Processed strictly one at a time. */
export type HeroEvent =
  | { id: string; kind: 'item'; itemId: string }
  | {
      id: string;
      kind: 'episode';
      itemId: string;
      seasonIndex: number;
      /** 0-based index of the slice that materializes. */
      episodeIndex: number;
      episodeCount: number;
      completesSeason: boolean;
    };

/** 'window' is the idle home view: eye level, facing the sunlit window. */
export type CameraFocus = 'window' | CategoryId;

/** Editable metadata of any item. */
export type ItemDetails = Pick<BaseItem, 'title' | 'creator' | 'year' | 'rating' | 'note' | 'coverUrl'>;

export type CatalogProvider = 'openlibrary' | 'itunes' | 'wikipedia' | 'manual';
export interface ItemSource {
  provider: CatalogProvider;
  id: string;
}

/**
 * The journal is a list of dated events. Items are the collection; events are the
 * diary of when you watched, read, played or listened.
 */
export type JournalEvent =
  | { id: string; itemId: string; ts: number; kind: 'log' | 'relog' }
  | { id: string; itemId: string; ts: number; kind: 'episode'; season: number; episode: number; completesSeason: boolean };

export interface PalaceSettings {
  /** Dust, cloud drift and beam shimmer after interactions. */
  ambient: boolean;
  haptics: boolean;
  /** Visual experience: crisp editorial, or the Frutiger Aero sky-and-glass world. */
  style?: 'editorial' | 'aero';
}
