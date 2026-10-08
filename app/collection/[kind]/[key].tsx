import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import DetailLayout from '@/components/media/DetailLayout';
import CheckButton from '@/components/ui/CheckButton';
import Poster from '@/components/ui/Poster';
import PressableScale from '@/components/ui/PressableScale';
import { FadeIn } from '@/components/ui/Motion';
import { makeStyles } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { imdbTitle, quiet } from '@/lib/api';
import { markDone, unmarkDone } from '@/lib/actions';
import { persisted } from '@/lib/cache';
import { CollectionEntry, CollectionItem, isDone, loadCollection, membersOf, mergeEntries, seriesOf } from '@/lib/collections';
import { countdown } from '@/lib/format';
import type { SeriesEntry, SeriesKind } from '@/lib/series';
import { Book, Game, Movie } from '@/lib/types';
import { useLibrary } from '@/store/useLibrary';
import { useUi } from '@/store/useUi';

const KINDS: SeriesKind[] = ['movie', 'book', 'game'];

/**
 * A film, book or game series, like a show's episode list: every entry in order, the ones you
 * don't have too, each with a tick. Tick one to mark it seen, read or played (added to the library
 * if needed); hold a tick to mark everything up to it.
 */
export default function CollectionScreen() {
  const params = useLocalSearchParams<{ kind: string; key: string; name?: string; qid?: string }>();
  const kind: SeriesKind = KINDS.includes(params.kind as SeriesKind) ? (params.kind as SeriesKind) : 'book';
  const key = String(params.key ?? '');
  const { t, i18n } = useTranslation();
  const styles = useStyles();
  const router = useRouter();
  const haptics = useHaptics();
  const items = useLibrary((s) => (kind === 'movie' ? s.movies : kind === 'book' ? s.books : s.games)) as Record<string, CollectionItem>;
  const members = useMemo(() => membersOf(Object.values(items), key), [items, key]);
  const name = members.map((m) => m.item.series?.name).find(Boolean) ?? params.name ?? members.map((m) => seriesOf(m.item)?.name).find(Boolean) ?? key;

  // The series as Wikidata (or Open Library) knows it, seeded by any entry it has an id for.
  const seeds = [params.qid, ...members.map((m) => m.item.wikidataId)].filter((q): q is string => !!q && /^Q\d+$/.test(q));
  const seedKey = [...new Set(seeds)].join(',');
  const seriesKey = [...new Set(members.map((m) => m.item.series?.id).filter((q): q is string => !!q && /^Q\d+$/.test(q)))].join(',');
  const [entries, setEntries] = useState<SeriesEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    setLoading(true);
    loadCollection(kind, name, seriesKey ? seriesKey.split(',') : [], seedKey ? seedKey.split(',') : [], i18n.language)
      .then(async (list) => {
        if (!live) return;
        setEntries(list);
        setLoading(false);
        // Films come without posters: IMDb's, a few at a time, kept on the device.
        if (kind !== 'movie') return;
        const bare = list.filter((e) => !e.cover && e.imdb);
        for (let i = 0; i < bare.length && live; i += 6) {
          const found = await Promise.all(
            bare.slice(i, i + 6).map(async (e) => [e.qid, await quiet(persisted(`imdb:${e.imdb}`, 30 * 86_400_000, async () => (await imdbTitle(e.imdb!))?.poster ?? '', (v) => !v), '')] as const),
          );
          const covers = new Map(found.filter(([, c]) => c));
          if (live && covers.size) setEntries((prev) => prev.map((e) => (covers.has(e.qid) ? { ...e, cover: covers.get(e.qid) } : e)));
        }
      })
      .catch(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // The name only matters when there is no seed (Open Library volumes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, seriesKey, seedKey, i18n.language]);

  const rows = useMemo(() => mergeEntries(kind, entries, members), [kind, entries, members]);
  const now = Date.now();
  const isOut = (r: CollectionEntry) => !r.date || r.date <= now || !r.exact;
  const out = rows.filter(isOut);
  const done = out.filter((r) => r.item && isDone(kind, r.item)).length;
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  /** Marked from here: a title added this way joins the series even before its own data says so. */
  const mark = async (r: CollectionEntry) => {
    const id = r.item?.id ?? r.href.split('/').pop()!;
    setBusy((b) => ({ ...b, [r.key]: true }));
    try {
      const final = await markDone(kind, id);
      const lib = useLibrary.getState();
      const added = (kind === 'movie' ? lib.movies : kind === 'book' ? lib.books : lib.games)[final] as CollectionItem | undefined;
      if (added && seriesOf(added)?.key !== key) {
        const series = { name, ordinal: r.ordinal != null ? String(r.ordinal) : undefined };
        if (kind === 'movie') lib.patchMovies({ [final]: { series, wikidataId: added.wikidataId ?? r.key, seriesAt: Date.now() } });
        else if (kind === 'book') lib.restoreBook({ ...(added as Book), series });
        else lib.restoreGame({ ...(added as Game), series });
      }
    } catch {
      useUi.getState().showToast(t('collection.failed', { title: r.title }));
    } finally {
      setBusy((b) => ({ ...b, [r.key]: false }));
    }
  };
  const toggle = (r: CollectionEntry) => {
    if (r.item && isDone(kind, r.item)) {
      unmarkDone(kind, r.item.id);
      haptics.tap();
      return;
    }
    haptics.success();
    mark(r);
  };
  /** Everything out up to this entry, a few at a time (titles not in the library are looked up). */
  const upTo = async (index: number) => {
    const todo = rows.slice(0, index + 1).filter((r) => isOut(r) && !(r.item && isDone(kind, r.item)) && !busy[r.key]);
    if (!todo.length) return;
    haptics.success();
    useUi.getState().showToast(t(`collection.upTo.${kind}`, { count: todo.length }));
    for (let i = 0; i < todo.length; i += 3) await Promise.all(todo.slice(i, i + 3).map(mark));
  };

  const lead = rows.find((r) => r.cover);
  const backdrop = members.map((m) => (m.item as Movie | Game).backdrop).find(Boolean);
  const meta = rows.length ? t(`collection.count.${kind}`, { count: rows.length }) : undefined;

  return (
    <DetailLayout kind={kind} title={name} poster={lead?.cover} backdrop={backdrop} meta={meta} loading={loading && !rows.length}>
      <FadeIn index={3} style={styles.panel}>
        <View style={styles.progressRow}>
          <Text style={styles.count}>{t(`collection.done.${kind}`, { done, count: out.length })}</Text>
          <Text style={styles.percent}>{out.length ? `${Math.round((done / out.length) * 100)} %` : ''}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${out.length ? Math.round((done / out.length) * 100) : 0}%` }]} />
        </View>
        <Text style={styles.hint}>{t('collection.hint')}</Text>
      </FadeIn>
      <View style={styles.list}>
        {rows.map((r, i) => {
          const checked = !!r.item && isDone(kind, r.item);
          const released = isOut(r);
          const when = r.date ? (r.date > now ? (r.exact ? countdown(r.date) : t('series.expected', { year: new Date(r.date).getUTCFullYear() })) : String(new Date(r.date).getUTCFullYear())) : undefined;
          const caption = [r.ordinal != null ? `#${r.ordinal}` : undefined, when, r.item && !checked ? t('collection.inLibrary') : undefined].filter(Boolean).join(' · ');
          return (
            <FadeIn key={r.key} index={Math.min(i, 12)} distance={8}>
              <PressableScale depth={0.99} onPress={() => router.push(r.href as never)} style={[styles.row, !released && { opacity: 0.6 }]} accessibilityLabel={r.title}>
                <Poster uri={r.cover} title={r.title} width={46} kind={kind} radius={8} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.name} numberOfLines={2}>
                    {r.title}
                  </Text>
                  {!!caption && <Text style={styles.caption}>{caption}</Text>}
                </View>
                <CheckButton
                  checked={checked}
                  disabled={!released || !!busy[r.key]}
                  onPress={() => toggle(r)}
                  onLongPress={released ? () => upTo(i) : undefined}
                  label={r.title}
                />
              </PressableScale>
            </FadeIn>
          );
        })}
      </View>
    </DetailLayout>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  panel: { marginTop: 22, padding: 16, gap: 10, borderRadius: radii.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { ...fonts.semibold, fontSize: 15, color: palette.ink },
  percent: { ...fonts.semibold, fontSize: 12.5, color: palette.inkSoft },
  track: { height: 6, borderRadius: 3, backgroundColor: palette.field, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: palette.primary },
  hint: { ...type.small, fontSize: 12.5 },
  list: { marginTop: 18, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radii.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  name: { ...fonts.semibold, fontSize: 14.5, color: palette.ink, letterSpacing: -0.15 },
  caption: { ...fonts.body, fontSize: 12, color: palette.inkSoft },
}));
