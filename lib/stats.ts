import { CATEGORIES, CategoryId, JournalEvent, PalaceItem } from './types';

const DAY = 86_400_000;

export const startOfDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Journal events grouped by calendar day, newest day first, newest event first. */
export function groupByDay(events: JournalEvent[]) {
  const map = new Map<number, JournalEvent[]>();
  [...events]
    .sort((a, b) => b.ts - a.ts)
    .forEach((e) => {
      const day = startOfDay(e.ts);
      const list = map.get(day);
      if (list) list.push(e);
      else map.set(day, [e]);
    });
  return [...map.entries()].map(([day, data]) => ({ day, data }));
}

export function eventsInYear(events: JournalEvent[], year: number) {
  return events.filter((e) => new Date(e.ts).getFullYear() === year);
}

export function countsByCategory(events: JournalEvent[], items: Record<string, PalaceItem>) {
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<CategoryId, number>;
  events.forEach((e) => {
    const item = items[e.itemId];
    if (item) out[item.category] += 1;
  });
  return out;
}

export function byMonth(events: JournalEvent[]) {
  const months = Array.from({ length: 12 }, () => 0);
  events.forEach((e) => (months[new Date(e.ts).getMonth()] += 1));
  return months;
}

/** Consecutive days with at least one log, ending today (or yesterday, so an unlogged morning keeps the streak). */
export function currentStreak(events: JournalEvent[], now = Date.now()) {
  const days = new Set(events.map((e) => startOfDay(e.ts)));
  let day = startOfDay(now);
  if (!days.has(day)) day -= DAY;
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day -= DAY;
  }
  return streak;
}

export function averageRating(items: PalaceItem[]) {
  const rated = items.filter((i) => i.rating);
  return rated.length ? rated.reduce((s, i) => s + (i.rating ?? 0), 0) / rated.length : 0;
}
