/**
 * Wikidata and Wikipedia helpers shared by books and games (keyless): entities by an external
 * id, labels, Wikipedia summaries, SPARQL, and dates written in words ("Nov 14, 2025").
 */
import { dateOf, getJson, quiet } from './api';
import { persisted } from './cache';

const API = 'https://www.wikidata.org/w/api.php?format=json&origin=*';
const SPARQL = 'https://query.wikidata.org/sparql';
export const WIKI_HEADERS = {
  'User-Agent': 'PalaisMental/1.4 (https://github.com/corentin-ne/palais-mental)',
  'Api-User-Agent': 'PalaisMental/1.4 (https://github.com/corentin-ne/palais-mental)',
};
const enc = encodeURIComponent;

export type Claims = Record<string, { mainsnak?: { datavalue?: { value?: any } }; qualifiers?: Record<string, { datavalue?: { value?: any } }[]> }[]>;

export interface Entity {
  id: string;
  label?: string;
  description?: string;
  claims: Claims;
  sitelinks: Record<string, { title: string }>;
}

/** Q-id of the item carrying `prop` = `value` (P648 Open Library work, P1733 Steam app…). */
export async function qidBy(prop: string, value: string): Promise<string | undefined> {
  // Kept on the device: links between ids rarely change, and every refresh asks again.
  const found = await quiet(
    persisted(
      `qid:${prop}=${value}`,
      14 * 86_400_000,
      async () => {
        const r = await getJson<any>(`${API}&action=query&list=search&srsearch=haswbstatement:${prop}=${enc(value)}&srlimit=1`);
        const qid: string | undefined = r?.query?.search?.[0]?.title;
        return qid && /^Q\d+$/.test(qid) ? qid : '';
      },
      (v) => !v,
    ),
    '',
  );
  return found || undefined;
}

export async function entity(qid: string, lang: string): Promise<Entity | undefined> {
  const r = await getJson<any>(`${API}&action=wbgetentities&ids=${qid}&props=labels|descriptions|claims|sitelinks&languages=${lang}|en&sitefilter=${lang}wiki|enwiki`);
  const e = r?.entities?.[qid];
  if (!e || e.missing != null) return undefined;
  return {
    id: qid,
    label: e.labels?.[lang]?.value ?? e.labels?.en?.value,
    description: e.descriptions?.[lang]?.value ?? e.descriptions?.en?.value,
    claims: e.claims ?? {},
    sitelinks: e.sitelinks ?? {},
  };
}

export const claimValues = (claims: Claims, prop: string): any[] => (claims[prop] ?? []).map((c) => c.mainsnak?.datavalue?.value).filter((v) => v != null);
export const claimString = (claims: Claims, prop: string): string | undefined => {
  const v = claimValues(claims, prop)[0];
  return typeof v === 'string' ? v : undefined;
};
export const claimIds = (claims: Claims, prop: string): string[] => claimValues(claims, prop).map((v) => v?.id).filter((id): id is string => typeof id === 'string');

/** Earliest publication date with day precision, else the earliest year. */
export function releaseOf(claims: Claims): { date?: number; year?: number } {
  const values = claimValues(claims, 'P577').filter((v) => v?.time);
  const full = values
    .filter((v) => v.precision >= 11)
    .map((v) => dateOf(String(v.time).replace(/^\+/, '').slice(0, 10)))
    .filter((d): d is number => !!d)
    .sort((a, b) => a - b);
  const years = values.map((v) => Number(String(v.time).replace(/^\+/, '').slice(0, 4))).filter((y) => y > 1000).sort((a, b) => a - b);
  return { date: full[0], year: full[0] ? new Date(full[0]).getUTCFullYear() : years[0] };
}

/** Series the item belongs to (P179) with its position (P1545). Label fetched separately. */
export function seriesClaim(claims: Claims): { id: string; ordinal?: string } | undefined {
  const c = claims.P179?.[0];
  const id = c?.mainsnak?.datavalue?.value?.id;
  if (!id) return undefined;
  const ordinal = c?.qualifiers?.P1545?.[0]?.datavalue?.value;
  return { id, ordinal: typeof ordinal === 'string' ? ordinal : undefined };
}

export async function labels(ids: string[], lang: string): Promise<Record<string, string>> {
  const unique = [...new Set(ids)].slice(0, 50);
  if (!unique.length) return {};
  const r = await quiet(getJson<any>(`${API}&action=wbgetentities&ids=${unique.join('|')}&props=labels&languages=${lang}|en`), null);
  const out: Record<string, string> = {};
  for (const id of unique) {
    const l = r?.entities?.[id]?.labels;
    const label = l?.[lang]?.value ?? l?.en?.value;
    if (label) out[id] = label;
  }
  return out;
}

/** Wikipedia's lead paragraph in your language, else English. */
export async function wikiSummary(e: Entity, lang: string) {
  const site = e.sitelinks[`${lang}wiki`] ? { lang, title: e.sitelinks[`${lang}wiki`].title } : e.sitelinks.enwiki ? { lang: 'en', title: e.sitelinks.enwiki.title } : undefined;
  if (!site) return undefined;
  const sum = await quiet(getJson<any>(`https://${site.lang}.wikipedia.org/api/rest_v1/page/summary/${enc(site.title.replace(/ /g, '_'))}`), null);
  return typeof sum?.extract === 'string' && sum.extract ? (sum.extract as string) : undefined;
}

/** Commons file → a resized image URL. */
export const commonsImage = (file?: string, width = 600) => (file ? `https://commons.wikimedia.org/wiki/Special:FilePath/${enc(file)}?width=${width}` : undefined);

/** SPARQL through GET, so answers share the in-memory cache. The service is often briefly busy (502, 429): one more try after a pause. */
export async function sparql<T = any>(query: string): Promise<T> {
  const url = `${SPARQL}?format=json&query=${enc(query)}`;
  const init = { headers: { ...WIKI_HEADERS, Accept: 'application/sparql-results+json' } };
  try {
    return await getJson<T>(url, init);
  } catch (e) {
    if (!/HTTP (429|50[234])/.test(String(e))) throw e;
    await new Promise((r) => setTimeout(r, 1500));
    return getJson<T>(url, init);
  }
}

/** Labels kept on the device for a month: names of people, studios and series rarely change. */
export function cachedLabels(ids: string[], lang: string) {
  const unique = [...new Set(ids)].sort();
  if (!unique.length) return Promise.resolve({} as Record<string, string>);
  return persisted(`labels:${lang}:${unique.join('|')}`, 30 * 86_400_000, () => labels(unique, lang), (v) => !Object.keys(v).length);
}

// ------------------------------------------------------------------ Dates in words
const MONTHS: Record<string, number> = {
  jan: 0, janv: 0, january: 0, janvier: 0,
  feb: 1, fev: 1, févr: 1, fevr: 1, february: 1, février: 1, fevrier: 1,
  mar: 2, march: 2, mars: 2,
  apr: 3, avr: 3, april: 3, avril: 3,
  may: 4, mai: 4,
  jun: 5, june: 5, juin: 5,
  jul: 6, juil: 6, july: 6, juillet: 6,
  aug: 7, août: 7, aout: 7, august: 7,
  sep: 8, sept: 8, september: 8, septembre: 8,
  oct: 9, october: 9, octobre: 9,
  nov: 10, november: 10, novembre: 10,
  dec: 11, déc: 11, december: 11, décembre: 11, decembre: 11,
};
const noonUtc = (y: number, m: number, d: number) => Date.UTC(y, m, d, 12);

/**
 * "2025-11-14", "Nov 14, 2025", "14 Nov, 2025", "14 nov. 2025", "November 2025", "2025".
 * Only a day-precise date becomes `date`; anything else gives at most a year.
 */
export function looseDate(s?: string | null): { date?: number; year?: number } {
  if (!s) return {};
  const iso = dateOf(s);
  if (iso) return { date: iso, year: new Date(iso).getUTCFullYear() };
  const text = s.toLocaleLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  const year = Number(text.match(/\b(1[5-9]\d{2}|20\d{2})\b/)?.[1]) || undefined;
  if (!year) return {};
  const words = text.split(' ');
  const month = words.map((w) => MONTHS[w]).find((m) => m != null);
  const day = Number(words.find((w) => /^\d{1,2}(er|st|nd|rd|th)?$/.test(w))?.replace(/\D/g, ''));
  if (month != null && day >= 1 && day <= 31) return { date: noonUtc(year, month, day), year };
  return { year };
}
