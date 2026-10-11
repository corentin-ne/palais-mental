import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import DetailLayout, { CastRail, Synopsis } from '@/components/media/DetailLayout';
import Extras, { Similar } from '@/components/media/Extras';
import EpisodeTalk from '@/components/friends/EpisodeTalk';
import FriendsBlock from '@/components/friends/FriendsBlock';
import EpisodeRow from '@/components/show/EpisodeRow';
import SeasonChips from '@/components/show/SeasonChips';
import ShowPanel from '@/components/show/ShowPanel';
import PressableScale from '@/components/ui/PressableScale';
import { animateLayout } from '@/components/ui/Motion';
import { makeStyles } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { Extras as ExtrasData, ShowDetails, fetchShow, fetchShowExtras, tvmazeIdByImdb, tvmazeIdByName } from '@/lib/api';
import { runtime } from '@/lib/format';
import { findTitle, loadPosts } from '@/lib/friends';
import { episodeCode, hasAired, progressOf, seasonsOf, showState } from '@/lib/progress';
import { useRibbons } from '@/lib/ribbons';
import { Episode, Show } from '@/lib/types';
import { Post, useFriends } from '@/store/useFriends';
import { useLibrary } from '@/store/useLibrary';
import { useUi } from '@/store/useUi';

export default function ShowScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const raw = decodeURIComponent(String(params.id ?? ''));
  // Recommendations arrive by name ("name:Severance") and adaptations by IMDb id ("imdb:tt…"):
  // find their TVmaze page, then swap in place.
  const byName = raw.startsWith('name:') ? raw.slice(5) : undefined;
  const byImdb = raw.startsWith('imdb:') ? raw.slice(5) : undefined;
  const id = byName || byImdb ? '' : raw;
  useEffect(() => {
    if (!byName && !byImdb) return;
    (byImdb ? tvmazeIdByImdb(byImdb) : tvmazeIdByName(byName!)).then((found) => (found ? router.replace(`/show/${found}`) : router.back()));
  }, [byName, byImdb, router]);
  const styles = useStyles();
  const haptics = useHaptics();
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

  // What friends said about its episodes: read when the page opens, shown episode by episode once ticked.
  const me = useFriends((s) => s.me);
  const sharedTitles = useFriends((s) => s.titles);
  const ribbon = useRibbons();
  const titleId = useMemo(() => (me && show ? findTitle(sharedTitles, 'show', show) : undefined), [me, sharedTitles, show]);
  const posts = useFriends((s) => (titleId != null ? s.posts[titleId] : undefined));
  useEffect(() => {
    if (titleId != null) loadPosts(titleId);
  }, [titleId]);
  const talk = useMemo(() => {
    const by = new Map<number, Post[]>();
    for (const p of posts ?? []) by.set(p.episode, [...(by.get(p.episode) ?? []), p]);
    return by;
  }, [posts]);
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
  /** Marks several episodes at once; the undo unmarks only the ones this added. */
  const markMany = (list: Episode[], message: string) => {
    ensureTracked();
    const before = useLibrary.getState().shows[id]?.watched ?? {};
    const added = list.filter((e) => !before[e.id]).map((e) => e.id);
    useLibrary.getState().setEpisodes(id, added, true);
    haptics.success();
    useUi.getState().showToast(message, added.length ? () => useLibrary.getState().setEpisodes(id, added, false) : undefined);
  };
  const watchUpTo = (e: Episode) => {
    if (!show) return;
    const upTo = show.episodes.filter((x) => (x.season < e.season || (x.season === e.season && x.number <= e.number)) && (hasAired(x) || x.id === e.id));
    markMany(upTo, t('toast.upTo', { code: episodeCode(e) }));
  };
  const seasonAired = episodes.filter((e) => hasAired(e));
  const seasonDone = seasonAired.length > 0 && seasonAired.every((e) => show?.watched[e.id]);
  const toggleSeason = () => {
    if (!seasonDone) return markMany(seasonAired, t('toast.seasonWatched', { n: current }));
    ensureTracked();
    const before = seasonAired.filter((e) => show?.watched[e.id]).map((e) => e.id);
    useLibrary.getState().setEpisodes(id, before, false);
    haptics.tap();
    useUi.getState().showToast(t('toast.seasonUnwatched', { n: current }), () => useLibrary.getState().setEpisodes(id, before, true));
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
      ribbon={show && ribbon('show', show)}
    >
      {show && progress && (
        <>
          <ShowPanel
            id={id}
            show={show}
            tracked={!!tracked}
            progress={progress}
            state={state}
            canFollow={!!details}
            onFollow={follow}
            onToggle={toggle}
            onMarkMany={markMany}
          />

          <FriendsBlock kind="show" item={show} tracked={!!tracked} rating={tracked?.rating} />
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
              <SeasonChips
                seasons={seasons}
                current={current}
                watched={show.watched}
                onPick={(n) => {
                  animateLayout(220);
                  setSeason(n);
                }}
              />
              <Text style={styles.hint}>{t('show.longPressHint')}</Text>
              <View style={styles.episodes}>
                {episodes.map((e, i) => (
                  <EpisodeRow
                    key={e.id}
                    e={e}
                    index={i}
                    watched={!!show.watched[e.id]}
                    isNext={!!tracked && state !== 'dropped' && progress.next?.id === e.id}
                    note={show.notes?.[e.id]}
                    onNote={(patch) => {
                      ensureTracked();
                      useLibrary.getState().setEpisodeNote(id, e.id, patch);
                    }}
                    synopsis={details?.synopsis[e.id]}
                    open={expanded === e.id}
                    onOpen={() => {
                      animateLayout(220);
                      setExpanded(expanded === e.id ? undefined : e.id);
                    }}
                    onToggle={() => toggle(e)}
                    onUpTo={() => watchUpTo(e)}
                    talkCount={me ? talk.get(e.id)?.length : undefined}
                    talk={me ? <EpisodeTalk show={show} titleId={titleId} episodeId={e.id} watched={!!show.watched[e.id]} posts={talk.get(e.id) ?? []} note={show.notes?.[e.id]} /> : undefined}
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

const useStyles = makeStyles(({ palette, fonts, type }) => ({
  sectionTitle: { ...type.title },
  seasonHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seasonToggle: { paddingVertical: 4 },
  seasonToggleText: { ...fonts.semibold, fontSize: 13.5, color: palette.primaryText },
  hint: { ...type.small, fontSize: 12, marginTop: -4 },
  episodes: { gap: 8 },
}));
