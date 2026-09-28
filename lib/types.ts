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
export type ItemDetails = Pick<BaseItem, 'title' | 'creator' | 'year' | 'rating' | 'note'>;

export interface PalaceSettings {
  /** Dust, cloud drift and beam shimmer after interactions. */
  ambient: boolean;
  haptics: boolean;
}
