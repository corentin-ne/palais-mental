/**
 * How long a game takes, on average, from HowLongToBeat (keyless): the main story, main + extras
 * and all styles, in hours. The site's search asks for a short-lived token first, tied to the
 * browser that asked: the same user agent is sent with both.
 */
import { quiet } from './api';
import { persisted } from './cache';
import { useLibrary } from '@/store/useLibrary';

const HLTB = 'https://howlongtobeat.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36',
  Referer: `${HLTB}/`,
  Origin: HLTB,
};
/** Tokens last about an hour; asked again past half of it, or when refused. */
const TOKEN_LIFE = 30 * 60_000;

export interface Playtime {
  main?: number;
  plus?: number;
  all?: number;
}

let token: { value: string; at: number } | undefined;

async function getToken(fresh = false) {
  if (!fresh && token && Date.now() - token.at < TOKEN_LIFE) return token.value;
  const r = await fetch(`${HLTB}/api/search/site/init?t=${Date.now()}`, { headers: { ...HEADERS, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const value: string | undefined = (await r.json())?.token;
  if (!value) throw new Error('no token');
  token = { value, at: Date.now() };
  return value;
}

const norm = (s: string) =>
  s
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[™®©]/g, '')
    .replace(/[^a-z0-9À-￿]+/g, ' ')
    .trim();

/** Seconds → hours, to the half hour. */
const hours = (s?: number) => (s && s > 0 ? Math.max(0.5, Math.round(s / 1800) / 2) : undefined);

async function search(title: string, year?: number): Promise<Playtime | null> {
  const body = JSON.stringify({
    searchType: 'games',
    searchTerms: norm(title).split(' '),
    searchPage: 1,
    size: 10,
    searchOptions: {
      games: { userId: 0, platform: '', sortCategory: 'popular', rangeCategory: 'main', rangeTime: { min: null, max: null }, gameplay: { perspective: '', flow: '', genre: '', difficulty: '' }, rangeYear: { min: '', max: '' }, modifier: '' },
      users: { sortCategory: 'postcount' },
      lists: { sortCategory: 'follows' },
      filter: '',
      sort: 0,
      randomizer: 0,
    },
    useCache: true,
  });
  const ask = async (fresh: boolean) =>
    fetch(`${HLTB}/api/search/site`, { method: 'POST', body, headers: { ...HEADERS, 'Content-Type': 'application/json', Accept: 'application/json', 'x-auth-token': await getToken(fresh) } });
  let r = await ask(false);
  if (r.status === 403) r = await ask(true);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data: any[] = (await r.json())?.data ?? [];
  const want = norm(title);
  // The same name (or alias) first, the same year breaks ties; else the most popular answer.
  const named = data.filter((d) => norm(String(d.game_name ?? '')) === want || String(d.game_alias ?? '').split(',').map(norm).includes(want));
  const pick = named.find((d) => !year || d.release_world === year) ?? named[0] ?? (year ? data.find((d) => d.release_world === year) : undefined) ?? data[0];
  if (!pick) return null;
  const out = { main: hours(pick.comp_main), plus: hours(pick.comp_plus), all: hours(pick.comp_all) };
  return out.main || out.plus || out.all ? out : null;
}

/** Average playtimes, kept a month on the device. */
export function playtimeOf(title: string, year?: number): Promise<Playtime | null> {
  return persisted(`hltb:${norm(title)}:${year ?? ''}`, 30 * 86_400_000, () => search(title, year), (v) => !v);
}

/** The hours most people put in: all play styles, else the main story. */
export const typicalHours = (p: Playtime | null | undefined) => p?.all ?? p?.plus ?? p?.main;

/** A game marked played without hours gets the average playtime. */
export async function fillPlaytime(id: string) {
  const game = useLibrary.getState().games[id];
  if (!game || game.hours) return;
  const h = typicalHours(await quiet(playtimeOf(game.title, game.year), null));
  const now = useLibrary.getState().games[id];
  if (h && now && !now.hours) useLibrary.getState().setGameProgress(id, { hours: h });
}
