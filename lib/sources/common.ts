/**
 * What every outside source is turned into before it reaches the library: one entry per title,
 * whatever the service (profile, feed, media server or export file), with ids when it has them.
 */
import { HttpError, norm } from '../api';

export { HttpError } from '../api';

export type Status = 'watched' | 'watching' | 'planned' | 'dropped';
export type EntryKind = 'show' | 'movie' | 'book' | 'game';

/** One title as another service sees it. For books and games: watched = finished, watching = started. */
export interface ExternalEntry {
  /** `${service}:${their id}`, stable across syncs. */
  key: string;
  kind: EntryKind;
  titles: string[];
  year?: number;
  imdbId?: string;
  tmdbId?: string;
  tvdbId?: string;
  malId?: number;
  status: Status;
  /** Episodes watched. */
  progress?: number;
  /** Episodes in that entry (anime lists count per season). */
  total?: number;
  watchedAt?: number;
  /** 1–10. */
  rating?: number;
  /** Exact episodes logged, each with its own date. */
  episodes?: { season: number; number: number; at?: number }[];
  /** Episodes known only by name (Netflix history): matched against the show's episode list. */
  episodeNames?: { season?: number; name: string; at?: number }[];
  /** Whole seasons logged. */
  seasons?: { season: number; at?: number }[];
  // Books
  authors?: string[];
  isbn?: string;
  /** Open Library work id (OL…W). */
  olWork?: string;
  /** The page you are at. */
  page?: number;
  // Games
  steamId?: string;
  platform?: string;
  hours?: number;
  /** Completion, 0–100. */
  percent?: number;
}

/** A source that needs something the account doesn't have (a key, a server address). */
export class MissingSetup extends Error {
  constructor(public what: 'token' | 'server' | 'username') {
    super(`Missing ${what}`);
  }
}

export const DAY = 86_400_000;
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const enc = encodeURIComponent;

export const rating10 = (v: unknown, scale = 1) => {
  const n = Number(v) * scale;
  return Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(10, Math.round(n))) : undefined;
};

/** "2024-05-01", ISO timestamps; a bare day is taken as that evening. */
export const dateMs = (s?: string | null) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(s)) return undefined;
  const t = Date.parse(s.length === 10 ? `${s}T20:00:00` : s);
  return Number.isFinite(t) ? t : undefined;
};

/** Any date a file or feed may hold: ISO, "2023/05/01", RFC 822, "05/31/2023", "31/05/2023". */
export function anyDate(s?: string | null, dayFirst = false): number | undefined {
  if (!s) return undefined;
  const v = s.trim();
  if (!v) return undefined;
  const iso = dateMs(v.replace(/^(\d{4})\/(\d{2})\/(\d{2})/, '$1-$2-$3'));
  if (iso) return iso;
  const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    let [a, b] = [Number(m[1]), Number(m[2])];
    const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    // Day first when asked, or when the first number can't be a month.
    if (dayFirst || a > 12) [a, b] = [b, a];
    const t = new Date(y, a - 1, b, 20).getTime();
    return Number.isFinite(t) ? t : undefined;
  }
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : undefined;
}

export const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');

/** Text of `<name>` in an XML block, CDATA unwrapped. */
export const xmlTag = (block: string, name: string) => {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? decodeXml(m[1].replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, '').trim()) || undefined : undefined;
};

/** ISBN digits only; "=\"9780…\"" (Goodreads) and hyphens removed. */
export const cleanIsbn = (s?: string | null) => {
  const d = String(s ?? '').replace(/[^0-9Xx]/g, '').toUpperCase();
  return d.length === 10 || d.length === 13 ? d : undefined;
};

/** A column whatever its spelling: the first header that matches. */
export function column(row: Record<string, string>, ...patterns: RegExp[]) {
  for (const re of patterns) for (const [k, v] of Object.entries(row)) if (re.test(k.trim())) return v;
  return undefined;
}

export const keyOf = (service: string, ...parts: (string | number | undefined)[]) => `${service}:${parts.map((p) => (typeof p === 'string' ? norm(p) : (p ?? ''))).join('|')}`;

/** fetch → JSON with the status kept, so a 404 (no such profile) reads differently from offline. */
export async function fetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { Accept: 'application/json', ...init?.headers } });
  if (!r.ok) throw new HttpError(r.status);
  return r.json();
}

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const r = await fetch(url, init);
  if (!r.ok) throw new HttpError(r.status);
  return r.text();
}

/** "https://host:port/path/" → "https://host:port/path"; a bare host gets http://. */
export const serverBase = (s?: string) => {
  const v = (s ?? '').trim().replace(/\/+$/, '');
  if (!v) return '';
  return /^[a-z]+:\/\//i.test(v) ? v : `http://${v}`;
};
