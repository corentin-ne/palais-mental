/** Anime lists read from public profiles: MyAnimeList (the list's own JSON) and AniList (public GraphQL). */
import { getJson, postJson } from '../api';
import { ExternalEntry, Status, enc, rating10, sleep } from './common';

/** MyAnimeList: the JSON behind a public anime list, 300 entries a page. */
export async function readMal(user: string): Promise<ExternalEntry[]> {
  const STATUS: Record<number, Status> = { 1: 'watching', 2: 'watched', 3: 'watching', 4: 'dropped', 6: 'planned' };
  const out: ExternalEntry[] = [];
  for (let offset = 0; offset < 6000; offset += 300) {
    const rows = await getJson<any[]>(`https://myanimelist.net/animelist/${enc(user.trim())}/load.json?status=7&offset=${offset}`);
    if (!Array.isArray(rows)) break;
    for (const r of rows) {
      const type = String(r.anime_media_type_string ?? '').toUpperCase();
      const kind = type === 'MOVIE' ? 'movie' : type === 'TV' || type === 'ONA' ? 'show' : undefined;
      const status = STATUS[Number(r.status)];
      if (!kind || !status || !r.anime_id) continue;
      out.push({
        key: `mal:${r.anime_id}`,
        kind,
        titles: [r.anime_title_eng, r.anime_title].filter((t): t is string => typeof t === 'string' && !!t.trim()),
        malId: Number(r.anime_id),
        status,
        progress: Number(r.num_watched_episodes) || 0,
        total: Number(r.anime_num_episodes) || undefined,
        watchedAt: Number(r.updated_at) ? Number(r.updated_at) * 1000 : undefined,
        rating: rating10(r.score),
      });
    }
    if (rows.length < 300) break;
    await sleep(800);
  }
  return out;
}

/** AniList: public lists through its GraphQL API (no token needed to read). */
export async function readAnilist(user: string): Promise<ExternalEntry[]> {
  const STATUS: Record<string, Status> = { CURRENT: 'watching', REPEATING: 'watching', PAUSED: 'watching', COMPLETED: 'watched', DROPPED: 'dropped', PLANNING: 'planned' };
  const query = `query ($name: String) { MediaListCollection(userName: $name, type: ANIME) { lists { entries {
    status progress score(format: POINT_10_DECIMAL) updatedAt completedAt { year month day }
    media { id idMal format episodes seasonYear title { romaji english } } } } } }`;
  const json = await postJson<any>('https://graphql.anilist.co', JSON.stringify({ query, variables: { name: user.trim() } }), { 'Content-Type': 'application/json' });
  if (json?.errors?.length) throw new Error(json.errors[0]?.message ?? 'AniList error');
  const out: ExternalEntry[] = [];
  for (const list of json?.data?.MediaListCollection?.lists ?? [])
    for (const e of list?.entries ?? []) {
      const m = e?.media;
      const kind = m?.format === 'MOVIE' ? 'movie' : ['TV', 'TV_SHORT', 'ONA'].includes(m?.format) ? 'show' : undefined;
      const status = STATUS[e?.status];
      if (!m?.id || !kind || !status) continue;
      const c = e.completedAt;
      const completed = c?.year ? new Date(c.year, (c.month ?? 1) - 1, c.day ?? 1, 20).getTime() : undefined;
      out.push({
        key: `anilist:${m.id}`,
        kind,
        titles: [m.title?.english, m.title?.romaji].filter((t: unknown): t is string => typeof t === 'string' && !!t.trim()),
        year: m.seasonYear ?? undefined,
        malId: m.idMal ?? undefined,
        status,
        progress: Number(e.progress) || 0,
        total: Number(m.episodes) || undefined,
        watchedAt: completed ?? (Number(e.updatedAt) ? Number(e.updatedAt) * 1000 : undefined),
        rating: rating10(e.score),
      });
    }
  return out;
}
