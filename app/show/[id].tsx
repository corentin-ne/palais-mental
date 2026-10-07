import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import DetailLayout, { CastRail, Synopsis } from '@/components/media/DetailLayout';
import Extras, { Similar } from '@/components/media/Extras';
import Button from '@/components/ui/Button';
import CheckButton from '@/components/ui/CheckButton';
import PressableScale from '@/components/ui/PressableScale';
import StarRating from '@/components/ui/StarRating';
import { FadeIn, animateLayout } from '@/components/ui/Motion';
import { makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { useLayout } from '@/hooks/useLayout';
import { Extras as ExtrasData, ShowDetails, fetchShow, fetchShowExtras, tvmazeIdByName } from '@/lib/api';
import { removeShow, setDropped } from '@/lib/actions';
import { countdown, fullDate, relativeDay, runtime } from '@/lib/format';
import { episodeCode, hasAired, progressOf, seasonsOf, showState } from '@/lib/progress';
import { Episode, Show } from '@/lib/types';
import { useLibrary } from '@/store/useLibrary';
import { useUi } from '@/store/useUi';

export default function ShowScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const raw = decodeURIComponent(String(params.id ?? ''));
  // Recommendations arrive by name ("name:Severance"): find their TVmaze page, then swap in place.
  const byName = raw.startsWith('name:') ? raw.slice(5) : undefined;
  const id = byName ? '' : raw;
  useEffect(() => {
    if (!byName) return;
    tvmazeIdByName(byName).then((found) => (found ? router.replace(`/show/${found}`) : router.back()));
  }, [byName, router]);
  const { palette } = useTheme();
  const styles = useStyles();
  const haptics = useHaptics();
  const { gutter } = useLayout();
  const tracked = useLibrary((s) => s.shows[id]);
  const tmdbKey = useLibrary((s) => s.settings.tmdbKey) || undefined;
  const [details, setDetails] = useState<ShowDetails>();
  const [error, setError] = useState(false);
  const [season, setSeason] = useState<number>();
  const [expanded, setExpanded] = useState<number>();
  const [extras, setExtras] = useState<ExtrasData>();

  const load = useCallback(() => {
    if (!id) return;
    setError(false);
    fetchShow(Number(id), tmdbKey)
      .then((d) => {
        setDetails(d);
        if (useLibrary.getState().shows[id]) useLibrary.getState().updateShow(d.show);
      })
      .catch(() => setError(!useLibrary.getState().shows[id]));
  }, [id, tmdbKey]);
  useEffect(load, [load]);

  const imdbId = tracked?.imdbId ?? details?.show.imdbId;
  useEffect(() => {
    fetchShowExtras(imdbId, { tmdbKey, lang: i18n.language }).then(setExtras);
  }, [imdbId, tmdbKey, i18n.language]);

  // The tracked copy carries what you watched; a show you don't follow yet is shown as is.
  const show: Show | undefined = useMemo(
    () => tracked ?? (details ? { ...details.show, watched: {}, addedAt: 0 } : undefined),
    [tracked, details],
  );
  const progress = show ? progressOf(show) : undefined;
  const state = show && tracked ? showState(show) : undefined;
  const seasons = useMemo(() => (show ? seasonsOf(show.episodes) : []), [show]);
  const current = season ?? progress?.next?.season ?? [...seasons].reverse().find((s) => s.episodes.some((e) => hasAired(e)))?.season ?? seasons[0]?.season;
  const episodes = seasons.find((s) => s.season === current)?.episodes ?? [];

  const ensureTracked = () => {
    if (!useLibrary.getState().shows[id] && details) useLibrary.getState().addShow(details.show);
  };
  const follow = () => {
    if (!details) return;
    haptics.success();
    useLibrary.getState().addShow(details.show);
    useUi.getState().showToast(t('toast.followed', { title: details.show.title }));
  };
  const toggle = (e: Episode) => {
    ensureTracked();
    const watched = useLibrary.getState().toggleEpisode(id, e.id);
    watched ? haptics.success() : haptics.tap();
  };
  const watchUpTo = (e: Episode) => {
    ensureTracked();
    useLibrary.getState().watchUpTo(id, e);
    haptics.success();
    useUi.getState().showToast(t('toast.upTo', { code: episodeCode(e) }));
  };
  const lastAired = show ? [...show.episodes].filter((e) => hasAired(e)).sort((a, b) => b.season - a.season || b.number - a.number)[0] : undefined;
  const seasonAired = episodes.filter((e) => hasAired(e));
  const seasonDone = seasonAired.length > 0 && seasonAired.every((e) => show?.watched[e.id]);
  const toggleSeason = () => {
    ensureTracked();
    useLibrary.getState().setEpisodes(id, seasonAired.map((e) => e.id), !seasonDone);
    haptics.success();
  };

  const meta = show
    ? [show.year, show.network, show.runtime ? runtime(show.runtime) : undefined, show.status ? t(`status.${show.status}`, { defaultValue: show.status }) : undefined]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  return (
    <DetailLayout
      kind="show"
      title={show?.title}
      poster={show?.poster}
      backdrop={show?.backdrop}
      meta={meta}
      tags={show?.genres}
      loading={!show}
      error={error}
      onRetry={load}
    >
      {show && progress && (
        <>
          {/* Where you are, and the one action that matters most right now. */}
          <FadeIn index={3} style={styles.panel}>
            {tracked ? (
              <>
                <View style={styles.progressHead}>
                  <Text style={styles.progressText}>
                    {state === 'dropped'
                      ? t('state.dropped')
                      : progress.aired
                        ? t('show.progress', { watched: Math.min(progress.watched, progress.aired), aired: progress.aired })
                        : t('show.notAired')}
                  </Text>
                  <Text style={styles.progressState}>{state ? t(`state.${state}`) : ''}</Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.round(progress.fraction * 100)}%`, backgroundColor: progress.fraction >= 1 ? palette.success : palette.primary }]} />
                </View>
                {progress.next && state !== 'dropped' && (
                  <Button label={t('show.watchedNext', { code: episodeCode(progress.next) })} icon="check" onPress={() => toggle(progress.next!)} style={{ marginTop: 6 }} />
                )}
                {progress.left > 1 && state !== 'dropped' && (
                  <PressableScale onPress={() => watchUpTo(lastAired!)} style={{ alignSelf: 'center', paddingVertical: 4 }}>
                    <Text style={styles.allLink}>{t('show.watchAll', { count: progress.left })}</Text>
                  </PressableScale>
                )}
                {!progress.next && progress.upcoming?.airstamp && (
                  <Text style={styles.nextAir}>{t('show.nextAirs', { code: episodeCode(progress.upcoming), when: countdown(progress.upcoming.airstamp) })}</Text>
                )}
                <View style={styles.rate}>
                  <Text style={styles.rateLabel}>{t('rating.yours')}</Text>
                  <StarRating value={tracked.rating} onChange={(v) => useLibrary.getState().setShowRating(id, v)} size={24} />
                </View>
                <View style={styles.actions}>
                  <Button
                    label={state === 'dropped' ? t('show.resume') : t('show.drop')}
                    icon={state === 'dropped' ? 'play' : 'pause'}
                    variant="ghost"
                    compact
                    onPress={() => {
                      haptics.tap();
                      setDropped(id, state !== 'dropped');
                    }}
                  />
                  <Button label={t('common.remove')} icon="trash" variant="danger" compact onPress={() => removeShow(id)} />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.progressText}>
                  {progress.upcoming?.airstamp ? t('show.followHintNext', { when: relativeDay(progress.upcoming.airstamp) }) : t('show.followHint')}
                </Text>
                <Button label={t('show.follow')} icon="plus" onPress={follow} disabled={!details} />
              </>
            )}
          </FadeIn>

          <Extras kind="show" title={show.title} year={show.year} imdbId={show.imdbId} extras={extras} />
          <Synopsis text={show.summary} />

          {seasons.length > 0 && (
            <View style={{ marginTop: 30, gap: 14 }}>
              <View style={styles.seasonHead}>
                <Text style={styles.sectionTitle}>{t('show.episodes')}</Text>
                {seasonAired.length > 0 && (
                  <PressableScale onPress={toggleSeason} style={styles.seasonToggle}>
                    <Text style={styles.seasonToggleText}>{seasonDone ? t('show.unwatchSeason') : t('show.watchSeason')}</Text>
                  </PressableScale>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ paddingHorizontal: gutter, gap: 8 }}>
                {seasons.map((s) => {
                  const active = s.season === current;
                  const aired = s.episodes.filter((e) => hasAired(e));
                  const done = aired.length > 0 && aired.every((e) => show.watched[e.id]);
                  return (
                    <PressableScale
                      key={s.season}
                      depth={0.92}
                      onPress={() => {
                        haptics.select();
                        animateLayout(220);
                        setSeason(s.season);
                      }}
                      style={[styles.seasonChip, active && styles.seasonChipActive]}
                    >
                      <Text style={[styles.seasonChipText, active && { color: palette.screen }]}>{t('show.season', { n: s.season })}</Text>
                      {done && <View style={[styles.doneDot, active && { backgroundColor: palette.screen }]} />}
                    </PressableScale>
                  );
                })}
              </ScrollView>
              <Text style={styles.hint}>{t('show.longPressHint')}</Text>
              <View style={styles.episodes}>
                {episodes.map((e, i) => (
                  <EpisodeRow
                    key={e.id}
                    e={e}
                    index={i}
                    watched={!!show.watched[e.id]}
                    synopsis={details?.synopsis[e.id]}
                    open={expanded === e.id}
                    onOpen={() => {
                      animateLayout(220);
                      setExpanded(expanded === e.id ? undefined : e.id);
                    }}
                    onToggle={() => toggle(e)}
                    onUpTo={() => watchUpTo(e)}
                  />
                ))}
              </View>
            </View>
          )}

          <CastRail cast={details?.cast ?? []} />
          <Similar kind="show" extras={extras} />
        </>
      )}
    </DetailLayout>
  );
}

function EpisodeRow({
  e,
  index,
  watched,
  synopsis,
  open,
  onOpen,
  onToggle,
  onUpTo,
}: {
  e: Episode;
  index: number;
  watched: boolean;
  synopsis?: string;
  open: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onUpTo: () => void;
}) {
  const { t } = useTranslation();
  const styles = useStyles();
  const aired = hasAired(e);
  return (
    <FadeIn index={index} distance={8}>
      <PressableScale depth={0.99} onPress={onOpen} style={[styles.episode, !aired && { opacity: 0.6 }]}>
        <View style={styles.epTop}>
          <View style={styles.still}>
            {e.image ? <Image source={{ uri: e.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : <Text style={styles.stillNum}>{e.number}</Text>}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.epCode}>{episodeCode(e)}</Text>
            <Text style={styles.epName} numberOfLines={open ? undefined : 2}>
              {e.name || t('show.episodeN', { n: e.number })}
            </Text>
            <Text style={styles.epDate}>
              {e.airstamp ? (aired ? fullDate(e.airstamp) : `${relativeDay(e.airstamp)} · ${countdown(e.airstamp)}`) : t('show.tba')}
            </Text>
          </View>
          <CheckButton checked={watched} onPress={onToggle} onLongPress={aired ? onUpTo : undefined} disabled={!aired} label={episodeCode(e)} />
        </View>
        {open && !!synopsis && <Text style={styles.epSynopsis}>{synopsis}</Text>}
      </PressableScale>
    </FadeIn>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  rate: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  rateLabel: { ...type.label },
  panel: { marginTop: 22, padding: 16, gap: 10, borderRadius: radii.lg, backgroundColor: palette.surface },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  progressText: { fontFamily: fonts.medium, fontSize: 14.5, color: palette.ink },
  progressState: { fontFamily: fonts.semibold, fontSize: 12.5, color: palette.primary },
  track: { height: 6, borderRadius: 3, backgroundColor: palette.field, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  nextAir: { ...type.small, color: palette.primary },
  allLink: { fontFamily: fonts.semibold, fontSize: 13.5, color: palette.primary },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  sectionTitle: { ...type.title },
  seasonHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seasonToggle: { paddingVertical: 4 },
  seasonToggleText: { fontFamily: fonts.semibold, fontSize: 13.5, color: palette.primary },
  seasonChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 15, borderRadius: 18, backgroundColor: palette.surface },
  seasonChipActive: { backgroundColor: palette.ink },
  seasonChipText: { fontFamily: fonts.semibold, fontSize: 13.5, color: palette.ink },
  doneDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.success },
  hint: { ...type.small, fontSize: 12, marginTop: -4 },
  episodes: { gap: 8 },
  episode: { padding: 10, borderRadius: radii.md, backgroundColor: palette.surface, gap: 10 },
  epTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  still: { width: 96, height: 56, borderRadius: 8, overflow: 'hidden', backgroundColor: palette.field, alignItems: 'center', justifyContent: 'center' },
  stillNum: { fontFamily: fonts.displayItalic, fontSize: 22, color: palette.inkFaint },
  epCode: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.6, color: palette.inkFaint },
  epName: { fontFamily: fonts.semibold, fontSize: 14.5, color: palette.ink, letterSpacing: -0.15 },
  epDate: { fontFamily: fonts.body, fontSize: 12, color: palette.inkSoft },
  epSynopsis: { ...type.small, color: palette.inkSoft, lineHeight: 19 },
}));
