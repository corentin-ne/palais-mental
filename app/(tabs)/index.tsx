import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import FriendsRail from '@/components/friends/FriendsRail';
import PosterRail, { RailItem } from '@/components/media/PosterRail';
import ShelfCard from '@/components/media/ShelfCard';
import UpNextCard from '@/components/media/UpNextCard';
import Button from '@/components/ui/Button';
import Empty from '@/components/ui/Empty';
import Icon from '@/components/ui/Icon';
import Poster from '@/components/ui/Poster';
import PressableScale from '@/components/ui/PressableScale';
import Screen, { Section } from '@/components/ui/Screen';
import { FadeIn } from '@/components/ui/Motion';
import { makeStyles, useTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { SearchResult, popularShows } from '@/lib/api';
import { countdown } from '@/lib/format';
import { syncFriends } from '@/lib/friends';
import { useRibbons, useSuggestions } from '@/lib/ribbons';
import { progressOf, showState } from '@/lib/progress';
import { shelfActivity, shelfState } from '@/lib/shelf';
import { OUT_NOW, refreshRelated, relatedHref, relationLabel, visibleRelated } from '@/lib/related';
import { refreshLibrary } from '@/lib/sync';
import { Book, Game } from '@/lib/types';
import { RelatedRelease, useConnections } from '@/store/useConnections';
import { useFriends } from '@/store/useFriends';
import { useLibrary } from '@/store/useLibrary';

/** What to watch now: the next episode of every show in progress, the books and games you're in, then what is waiting. Dates live in the calendar. */
export default function UpNextScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { inner, gap, wide } = useLayout();
  const shows = useLibrary((s) => s.shows);
  const movies = useLibrary((s) => s.movies);
  const books = useLibrary((s) => s.books);
  const games = useLibrary((s) => s.games);
  const relatedOn = useLibrary((s) => s.settings.related);
  const related = useConnections((s) => s.related.entries);
  const ribbon = useRibbons();
  const suggestions = useSuggestions();
  const social = useFriends((s) => !!s.me);
  const [refreshing, setRefreshing] = useState(false);

  const { upNext, waiting } = useMemo(() => {
    const now = Date.now();
    const list = Object.values(shows).map((show) => ({ show, progress: progressOf(show, now), state: showState(show, now) }));
    const lastActivity = (s: (typeof list)[number]) => Math.max(s.show.addedAt, ...Object.values(s.show.watched));
    return {
      upNext: list.filter((s) => s.state === 'watching').sort((a, b) => lastActivity(b) - lastActivity(a)),
      // Shows not started and films on the watchlist, one rail, latest added first.
      waiting: [
        ...list
          .filter((s) => s.state === 'notStarted')
          .map(({ show, progress }) => ({
            addedAt: show.addedAt,
            item: {
              key: show.id,
              href: `/show/${show.tvmazeId}`,
              title: show.title,
              poster: show.poster,
              kind: 'show',
              ribbon: ribbon('show', show),
              caption: progress.aired ? t('upNext.episodes', { count: progress.aired }) : progress.upcoming?.airstamp ? countdown(progress.upcoming.airstamp) : undefined,
            } as RailItem,
          })),
        ...Object.values(movies)
          .filter((m) => !m.watchedAt && (!m.releaseDate || m.releaseDate <= now))
          .map((m) => ({
            addedAt: m.addedAt,
            item: { key: m.id, href: `/movie/${m.id}`, title: m.title, poster: m.poster, kind: 'movie', ribbon: ribbon('movie', m), caption: m.year ? String(m.year) : undefined } as RailItem,
          })),
      ]
        .sort((a, b) => b.addedAt - a.addedAt)
        .map((w) => w.item),
    };
  }, [shows, movies, t, ribbon]);

  // Books and games you're in the middle of, last touched first.
  const { reading, playing } = useMemo(() => {
    const now = Date.now();
    const byActivity = (a: Book | Game, b: Book | Game) => shelfActivity(b) - shelfActivity(a);
    return {
      reading: Object.values(books).filter((b) => shelfState(b, now) === 'started').sort(byActivity),
      playing: Object.values(games).filter((g) => shelfState(g, now) === 'started').sort(byActivity),
    };
  }, [books, games]);

  // Sequels and same-universe titles released lately that you don't have yet.
  const outNow = useMemo(() => {
    if (!relatedOn) return [];
    const now = Date.now();
    return visibleRelated(related)
      .filter((r) => r.date <= now && r.date > now - OUT_NOW)
      .sort((a, b) => b.date - a.date);
  }, [relatedOn, related, shows, movies]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Social catches up on its own: a server that is slow or asleep must not hold the spinner.
    void syncFriends(true);
    await refreshLibrary(true);
    await refreshRelated(true);
    setRefreshing(false);
  }, []);

  const empty = !Object.keys(shows).length && !Object.keys(movies).length && !Object.keys(books).length && !Object.keys(games).length;
  const cols = wide ? 2 : 1;
  const cardW = Math.floor((inner - gap * (cols - 1)) / cols);
  // What friends recommend that you don't have yet (nothing until you have joined them).
  const friendsSection = suggestions.length > 0 && (
    <Section
      title={t('friends.suggested')}
      count={suggestions.length}
      action={
        <PressableScale onPress={() => router.push('/social' as never)} style={styles.link}>
          <Text style={styles.linkText}>{t('common.seeAll')}</Text>
          <Icon name="chevronRight" size={14} color={palette.primaryText} strokeWidth={2.2} />
        </PressableScale>
      }
    >
      <FriendsRail items={suggestions} />
    </Section>
  );

  return (
    <Screen
      title={t('upNext.title')}
      subtitle={greeting(t)}
      refreshing={refreshing}
      onRefresh={onRefresh}
      right={
        // Social, one tap away once you have a name (before that, nothing here changes).
        social ? (
          <PressableScale onPress={() => router.push('/social' as never)} style={styles.social} accessibilityLabel={t('friends.title')}>
            <Icon name="heart" size={20} color={palette.ink} />
          </PressableScale>
        ) : undefined
      }
    >
      {empty ? (
        <>
          <Welcome />
          {friendsSection}
        </>
      ) : (
        <>
          {upNext.length > 0 || !Object.keys(shows).length ? (
            upNext.length > 0 && (
              <Section title={t('upNext.episodes')} count={upNext.length} style={{ marginTop: 18 }}>
                <View style={[styles.cards, { gap, marginTop: 0 }]}>
                  {upNext.map(({ show, progress }, i) => (
                    <FadeIn key={show.id} index={i}>
                      <UpNextCard show={show} progress={progress} width={cardW} />
                    </FadeIn>
                  ))}
                </View>
              </Section>
            )
          ) : (
            <FadeIn style={styles.allCaught}>
              <Icon name="check" size={20} color={palette.success} strokeWidth={2.4} />
              <Text style={styles.allCaughtText}>{t('upNext.caughtUp')}</Text>
            </FadeIn>
          )}

          {reading.length > 0 && (
            <Section title={t('upNext.reading')} count={reading.length}>
              <View style={[styles.cards, { gap, marginTop: 0 }]}>
                {reading.map((b, i) => (
                  <FadeIn key={b.id} index={i}>
                    <ShelfCard kind="book" item={b} width={cardW} />
                  </FadeIn>
                ))}
              </View>
            </Section>
          )}

          {playing.length > 0 && (
            <Section title={t('upNext.playing')} count={playing.length}>
              <View style={[styles.cards, { gap, marginTop: 0 }]}>
                {playing.map((g, i) => (
                  <FadeIn key={g.id} index={i}>
                    <ShelfCard kind="game" item={g} width={cardW} />
                  </FadeIn>
                ))}
              </View>
            </Section>
          )}

          {friendsSection}

          {outNow.length > 0 && (
            <Section title={t('related.outNow')}>
              <RelatedRail items={outNow} />
            </Section>
          )}

          {waiting.length > 0 && (
            <Section title={t('upNext.waiting')} count={waiting.length}>
              <PosterRail items={waiting} />
            </Section>
          )}
        </>
      )}
    </Screen>
  );
}

/** Like PosterRail, but series open through TVmaze once tapped. */
function RelatedRail({ items }: { items: RelatedRelease[] }) {
  const router = useRouter();
  const styles = useStyles();
  const { gutter, railPoster } = useLayout();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ paddingHorizontal: gutter, gap: 14, paddingBottom: 6 }}>
      {items.map((r, i) => (
        <FadeIn key={r.imdbId} index={i} distance={10}>
          <PressableScale onPress={async () => router.push((await relatedHref(r)) as never)} style={{ width: railPoster, gap: 8 }} accessibilityLabel={r.title}>
            <Poster uri={r.poster} title={r.title} width={railPoster} kind={r.kind} />
            <View style={{ gap: 1 }}>
              <Text style={styles.soonTitle} numberOfLines={1}>
                {r.title}
              </Text>
              <Text style={styles.soonDetail} numberOfLines={1}>
                {relationLabel(r)}
              </Text>
            </View>
          </PressableScale>
        </FadeIn>
      ))}
    </ScrollView>
  );
}

function greeting(t: (k: string) => string) {
  const h = new Date().getHours();
  return t(h < 5 ? 'greeting.night' : h < 12 ? 'greeting.morning' : h < 18 ? 'greeting.afternoon' : 'greeting.evening');
}

/** First run: one sentence, a search button, and what is on tonight to get going. */
function Welcome() {
  const { t } = useTranslation();
  const router = useRouter();
  const [popular, setPopular] = useState<SearchResult[]>([]);
  useEffect(() => {
    popularShows().then(setPopular);
  }, []);
  return (
    <View>
      <Empty icon="sparkle" title={t('welcome.title')} body={t('welcome.body')} cta={t('welcome.cta')} onPress={() => router.push('/search')} />
      {popular.length > 0 && (
        <Section title={t('search.onTonight')}>
          <PosterRail
            items={popular.map((p) => ({ key: p.id, href: `/show/${p.id}`, title: p.title, poster: p.poster, kind: 'show', caption: p.subtitle }))}
          />
        </Section>
      )}
      <View style={{ alignItems: 'center', marginTop: 28, gap: 6 }}>
        <Button label={t('welcome.connect')} icon="link" variant="ghost" compact onPress={() => router.push('/connections')} />
        <Button label={t('welcome.import')} icon="upload" variant="ghost" compact onPress={() => router.push('/data' as never)} />
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii }) => ({
  cards: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 18 },
  allCaught: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, padding: 16, borderRadius: radii.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  allCaughtText: { ...fonts.medium, fontSize: 15, color: palette.ink },
  social: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline, marginBottom: 2 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4 },
  linkText: { ...fonts.semibold, fontSize: 14, color: palette.primaryText },
  soonTitle: { ...fonts.semibold, fontSize: 14.5, color: palette.ink },
  soonDetail: { ...fonts.body, fontSize: 12.5, color: palette.inkSoft },
}));
