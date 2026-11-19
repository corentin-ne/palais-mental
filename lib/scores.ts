/**
 * What critics and audiences made of a film or a show, from Wikidata's review scores (P444, keyless):
 * Rotten Tomatoes, Metacritic and IMDb, each with the score as the site writes it.
 */
import { quiet } from './api';
import { persisted } from './cache';
import { CriticScore, ScoreSource, scoresFrom } from './scoreParse';
import { entity, qidBy } from './wikidata';

export type { CriticScore, ScoreSource } from './scoreParse';

/** Scores for a title known by its Wikidata or IMDb id, kept a week on the device. */
export async function criticScores(ids: { wikidataId?: string; imdbId?: string }): Promise<CriticScore[]> {
  const qid = (ids.imdbId ? await qidBy('P345', ids.imdbId) : undefined) ?? ids.wikidataId;
  if (!qid) return [];
  return quiet(
    persisted(
      `scores:${qid}`,
      7 * 86_400_000,
      async () => {
        const e = await entity(qid, 'en');
        return e ? scoresFrom(e.claims) : [];
      },
      (v) => !v.length,
    ),
    [],
  );
}

export const scoreUrl = (source: ScoreSource, title: string, imdbId?: string) =>
  source === 'imdb' && imdbId
    ? `https://www.imdb.com/title/${imdbId}/`
    : source === 'mc'
      ? `https://www.metacritic.com/search/${encodeURIComponent(title)}/`
      : `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}`;
