/** Pure: review scores read from Wikidata claims (P444 with P447 "review score by"). */
import type { Claims } from './wikidata';

export type ScoreSource = 'rt' | 'mc' | 'imdb';

export interface CriticScore {
  source: ScoreSource;
  /** As written: "93%", "81/100", "8.1/10". */
  value: string;
  /** 0–1, for a colour. */
  fraction?: number;
}

/** Wikidata items of the review sites (P447 "review score by"). */
const BY: Record<string, ScoreSource> = { Q105584: 'rt', Q150248: 'mc', Q37312: 'imdb' };

/** "93%", "81/100", "8.1/10" → 0.93, 0.81, 0.81. */
export function fractionOf(value: string): number | undefined {
  const pct = /^(\d+(?:\.\d+)?)\s*%$/.exec(value.trim());
  if (pct) return Math.min(1, Number(pct[1]) / 100);
  const ratio = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(value.trim());
  if (ratio && Number(ratio[2])) return Math.min(1, Number(ratio[1]) / Number(ratio[2]));
  return undefined;
}

/** One score per site: the latest one Wikidata has (scores are added over time, the newest last). */
export function scoresFrom(claims: Claims): CriticScore[] {
  const out = new Map<ScoreSource, CriticScore>();
  for (const c of claims.P444 ?? []) {
    const value = c.mainsnak?.datavalue?.value;
    const by = c.qualifiers?.P447?.[0]?.datavalue?.value?.id;
    const source = by ? BY[by] : undefined;
    if (!source || typeof value !== 'string' || !value.trim()) continue;
    const score = { source, value: value.trim().replace(/\s+/g, ''), fraction: fractionOf(value) };
    // Rotten Tomatoes also lists an average rating ("9.1/10"): the Tomatometer, in %, is the one people know.
    const pct = (x?: CriticScore) => !!x?.value.endsWith('%');
    if (source === 'rt' && pct(out.get('rt')) && !pct(score)) continue;
    out.set(source, score);
  }
  return (['rt', 'mc', 'imdb'] as ScoreSource[]).map((s) => out.get(s)).filter((s): s is CriticScore => !!s);
}

