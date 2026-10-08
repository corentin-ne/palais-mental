import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

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
import { countdown, relativeDay } from '@/lib/format';
import { episodeCode, progressOf, showState } from '@/lib/progress';
import { shelfActivity, shelfState } from '@/lib/shelf';
import { OUT_NOW, refreshRelated, relatedHref, relationLabel, visibleRelated } from '@/lib/related';
import { getUpcoming, refreshLibrary } from '@/lib/sync';
import { Book, Game } from '@/lib/types';
import { RelatedRelease, useConnections } from '@/store/useConnections';
import { useLibrary } from '@/store/useLibrary';

/** What to watch now: the next episode of every show in progress, the books and games you're in, then what is waiting. */
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
  const [refreshing, setRefreshing] = useState(false);

  const { upNext, notStarted, watchlist, soon } = useMemo(() => {
    const now = Date.now();
    const list = Object.values(shows).map((show) => ({ show, progress: progressOf(show, now), state: showState(show, now) }));
    const lastActivity = (s: (typeof list)[number]) => Math.max(s.show.addedAt, ...Object.values(s.show.watched));
    return {
      upNext: list.filter((s) => s.state === 'watching').sort((a, b) => lastActivity(b) - lastActivity(a)),
      notStarted: list
        .filter((s) => s.state === 'notStarted')
        .sort((a, b) => b.show.addedAt - a.show.addedAt)
        .map(
          ({ show, progress }): RailItem => ({
            key: show.id,
            href: `/show/${show.tvmazeId}`,
            title: show.title,
            poster: show.poster,
            kind: 'show',
            caption: progress.aired ? t('upNext.episodes', { count: progress.aired }) : progress.upcoming?.airstamp ? countdown(progress.upcoming.airstamp) : undefined,
          }),
        ),
      watchlist: Object.values(movies)
        .filter((m) => !m.watchedAt && (!m.releaseDate || m.releaseDate <= now))
        .sort((a, b) => b.addedAt - a.addedAt)
        .map((m): RailItem => ({ key: m.id, href: `/movie/${m.id}`, title: m.title, poster: m.poster, kind: 'movie', caption: m.year ? String(m.year) : undefined })),
      soon: getUpcoming(shows, movies, now, [], books, games)
        .filter((u) => u.date > now)
        .slice(0, 5),
    };
  }, [shows, movies, books, games, t]);

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
    await refreshLibrary(true);
    await refreshRelated(true);
    setRefreshing(false);
  }, []);

  const empty = !Object.keys(shows).length && !Object.keys(movies).length && !Object.keys(books).length && !Object.keys(games).length;
  const cols = wide ? 2 : 1;
  const cardW = Math.floor((inner - gap * (cols - 1)) / cols);

  return (
    <Screen title={t('upNext.title')} subtitle={greeting(t)} refreshing={refreshing} onRefresh={onRefresh}>
      {empty ? (
        <Welcome />
      ) : (
        <>
          {upNext.length > 0 || !Object.keys(shows).length ? (
            <View style={[styles.cards, { gap }]}>
              {upNext.map(({ show, progress }, i) => (
                <FadeIn key={show.id} index={i}>
                  <UpNextCard show={show} progress={progress} width={cardW} />
                </FadeIn>
              ))}
            </View>
          ) : (
            <FadeIn style={styles.allCaught}>
              <Icon name="check" size={20} color={palette.success} strokeWidth={2.4} />
              <Text style={styles.allCaughtText}>{t('upNext.caughtUp')}</Text>
            </FadeIn>
          )}

          {reading.length > 0 && (
            <Section title={t('upNext.reading')}>
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
            <Section title={t('upNext.playing')}>
              <View style={[styles.cards, { gap, marginTop: 0 }]}>
                {playing.map((g, i) => (
                  <FadeIn key={g.id} index={i}>
                    <ShelfCard kind="game" item={g} width={cardW} />
                  </FadeIn>
                ))}
              </View>
            </Section>
          )}

          {soon.length > 0 && (
            <Section
              title={t('upNext.comingUp')}
              action={
                <PressableScale onPress={() => router.navigate('/calendar')} style={styles.link}>
                  <Text style={styles.linkText}>{t('common.seeAll')}</Text>
                  <Icon name="chevronRight" size={14} color={palette.primaryText} strokeWidth={2.2} />
                </PressableScale>
              }
            >
              <View style={styles.soonList}>
                {soon.map((u, i) => {
                  if (u.kind === 'related') return null;
                  const { title, detail, href, icon } =
                    u.kind === 'episode'
                      ? { title: u.show.title, detail: `${episodeCode(u.episode)} · ${u.episode.name}`, href: `/show/${u.show.tvmazeId}`, icon: 'series' as const }
                      : u.kind === 'movie'
                        ? { title: u.movie.title, detail: t('calendar.inTheaters'), href: `/movie/${u.movie.id}`, icon: 'movies' as const }
                        : u.kind === 'book'
                          ? { title: u.book.title, detail: t('calendar.bookOut'), href: `/book/${u.book.id}`, icon: 'journal' as const }
                          : { title: u.game.title, detail: t('calendar.gameOut'), href: `/game/${u.game.id}`, icon: 'gamepad' as const };
                  return (
                    <FadeIn key={`${title}${u.date}${i}`} index={i}>
                      <PressableScale depth={0.98} onPress={() => router.push(href as never)} style={styles.soonRow}>
                        <View style={styles.when}>
                          <Text style={styles.whenText} numberOfLines={1}>
                            {relativeDay(u.date)}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.soonTitle} numberOfLines={1}>
                            {title}
                          </Text>
                          <Text style={styles.soonDetail} numberOfLines={1}>
                            {detail}
                          </Text>
                        </View>
                        <Icon name={icon} size={18} color={palette.inkFaint} />
                      </PressableScale>
                    </FadeIn>
                  );
                })}
              </View>
            </Section>
          )}

          {outNow.length > 0 && (
            <Section title={t('related.outNow')}>
              <RelatedRail items={outNow} />
            </Section>
          )}

          {notStarted.length > 0 && (
            <Section title={t('upNext.notStarted')}>
              <PosterRail items={notStarted} />
            </Section>
          )}
          {watchlist.length > 0 && (
            <Section title={t('upNext.watchlist')}>
              <PosterRail items={watchlist} />
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
        <Button label={t('welcome.import')} icon="upload" variant="ghost" compact onPress={() => router.navigate('/profile')} />
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii }) => ({
  cards: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 18 },
  allCaught: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, padding: 16, borderRadius: radii.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  allCaughtText: { ...fonts.medium, fontSize: 15, color: palette.ink },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4 },
  linkText: { ...fonts.semibold, fontSize: 14, color: palette.primaryText },
  soonList: { borderRadius: radii.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline, paddingVertical: 4 },
  soonRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 11 },
  when: { width: 86 },
  whenText: { ...fonts.semibold, fontSize: 13, color: palette.primaryText },
  soonTitle: { ...fonts.semibold, fontSize: 14.5, color: palette.ink },
  soonDetail: { ...fonts.body, fontSize: 12.5, color: palette.inkSoft },
}));
