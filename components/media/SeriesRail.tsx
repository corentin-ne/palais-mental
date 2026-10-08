import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import PosterRail from './PosterRail';
import { makeStyles } from '@/constants/theme';
import { countdown } from '@/lib/format';
import { SeriesEntry, SeriesKind, fetchSeries } from '@/lib/series';
import { useLibrary } from '@/store/useLibrary';

/**
 * The rest of the series a book or game belongs to, prequels and sequels included, in order,
 * with release dates (announced ones as a countdown). Entries in your library are ticked.
 */
export default function SeriesRail({ qid, kind, ordinal }: { qid?: string; kind: SeriesKind; ordinal?: string }) {
  const { t, i18n } = useTranslation();
  const styles = useStyles();
  const [entries, setEntries] = useState<SeriesEntry[]>([]);
  const mine = useLibrary((s) => {
    const ids = new Set<string>();
    for (const x of Object.values(kind === 'book' ? s.books : s.games)) if (x.wikidataId) ids.add(x.wikidataId);
    return [...ids].sort().join(',');
  });

  useEffect(() => {
    setEntries([]);
    if (!qid) return;
    let live = true;
    fetchSeries(qid, kind, i18n.language)
      .then((list) => live && setEntries(list))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [qid, kind, i18n.language]);

  if (!entries.length) return null;
  const have = new Set(mine.split(','));
  const series = entries.find((e) => e.series)?.series;
  const now = Date.now();
  const caption = (e: SeriesEntry) => {
    const place = e.relation === 'prequel' ? t('series.prequel') : e.relation === 'sequel' ? t('series.sequel') : e.ordinal ? `#${e.ordinal}` : undefined;
    const when = e.date ? (e.date > now ? (e.exact ? countdown(e.date) : t('series.expected', { year: new Date(e.date).getUTCFullYear() })) : String(new Date(e.date).getUTCFullYear())) : t('series.announced');
    return [have.has(e.qid) ? '✓' : undefined, place, when].filter(Boolean).join(' · ');
  };

  return (
    <View style={{ marginTop: 30, gap: 14 }}>
      <View style={{ gap: 2 }}>
        <Text style={styles.title}>{series ?? t('series.title')}</Text>
        {!!ordinal && <Text style={styles.hint}>{t(kind === 'book' ? 'series.bookN' : 'series.gameN', { n: ordinal })}</Text>}
      </View>
      <PosterRail items={entries.map((e) => ({ key: e.qid, href: e.href, title: e.title, poster: e.cover, kind, caption: caption(e) }))} />
    </View>
  );
}

const useStyles = makeStyles(({ type }) => ({
  title: { ...type.title },
  hint: { ...type.small },
}));
