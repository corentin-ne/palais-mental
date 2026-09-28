import { PalaceItem } from './types';

/** Localized long date ("12 March 2026" / "12 mars 2026"), with a safe fallback. */
export function formatDate(ts: number, lng: string) {
  try {
    return new Intl.DateTimeFormat(lng, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ts));
  } catch {
    return new Date(ts).toDateString();
  }
}

/** "Wong Kar-wai · 2000" — whatever of the two exists. */
export function itemMeta(item: Pick<PalaceItem, 'creator' | 'year'>) {
  return [item.creator, item.year].filter(Boolean).join(' · ');
}
