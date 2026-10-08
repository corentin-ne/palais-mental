/** Season numbers written into titles ("Season 2", "2nd Season", "Saison 3", "S4"). */
const SEASON_PATTERNS = [/\bseason\s*(\d+)\b/i, /\b(\d+)(?:st|nd|rd|th)\s+season\b/i, /\bsaison\s*(\d+)\b/i, /\bS(\d+)$/];
export function seasonHint(title: string) {
  for (const re of SEASON_PATTERNS) {
    const m = title.match(re);
    if (m) return Number(m[1]);
  }
  return undefined;
}
export const stripSeason = (title: string) =>
  SEASON_PATTERNS.reduce((t, re) => t.replace(re, ''), title)
    .replace(/\bpart\s*\d+\b/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[\s:,-]+$/, '')
    .trim();

