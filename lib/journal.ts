/** Pure: the notes you kept, episodes and reviews of every kind, latest first. */
import { episodeCode } from './progress';
import { Book, Game, MediaKind, Movie, Show } from './types';

export interface JournalEntry {
  key: string;
  /** Only to order the notes: never shown. */
  at: number;
  title: string;
  detail: string;
  poster?: string;
  kind: MediaKind;
  /** Episode notes (`show` with an episode) apart from reviews. */
  episode: boolean;
  rating?: number;
  text?: string;
  href: string;
}

type Library = { shows: Record<string, Show>; movies: Record<string, Movie>; books: Record<string, Book>; games: Record<string, Game> };

export function journalEntries(lib: Library, t: (key: string) => string): JournalEntry[] {
  const out: JournalEntry[] = [];
  for (const show of Object.values(lib.shows)) {
    const byId = new Map(show.episodes.map((e) => [String(e.id), e]));
    const href = `/show/${show.tvmazeId}`;
    for (const [id, note] of Object.entries(show.notes ?? {})) {
      const e = byId.get(id);
      out.push({
        key: `${show.id}-${id}`,
        at: note.at,
        title: show.title,
        detail: e ? `${episodeCode(e)}${e.name ? ` · ${e.name}` : ''}` : t('journal.episode'),
        poster: show.poster,
        kind: 'show',
        episode: true,
        rating: note.rating,
        text: note.text,
        href,
      });
    }
    if (show.review)
      out.push({ key: `${show.id}-review`, at: show.reviewedAt ?? show.addedAt, title: show.title, detail: t('journal.review.show'), poster: show.poster, kind: 'show', episode: false, rating: show.rating, text: show.review, href });
  }
  const reviews: [MediaKind, (Movie | Book | Game)[]][] = [
    ['movie', Object.values(lib.movies)],
    ['book', Object.values(lib.books)],
    ['game', Object.values(lib.games)],
  ];
  for (const [kind, items] of reviews)
    for (const item of items)
      if (item.review)
        out.push({
          key: `${item.id}-review`,
          at: item.reviewedAt ?? item.addedAt,
          title: item.title,
          detail: t(`journal.review.${kind}`),
          poster: kind === 'movie' ? (item as Movie).poster : (item as Book | Game).cover,
          kind,
          episode: false,
          rating: item.rating,
          text: item.review,
          href: `/${kind}/${item.id}`,
        });
  return out.sort((a, b) => b.at - a.at);
}
