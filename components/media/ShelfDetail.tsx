import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import CollectionLink from './CollectionLink';
import DetailLayout, { Synopsis } from './DetailLayout';
import SeriesRail from './SeriesRail';
import { ExtraDetails, ExtraLinks, ExtraRails, ExtraScores } from './ShelfExtras';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import StarRating from '@/components/ui/StarRating';
import Stepper from '@/components/ui/Stepper';
import { FadeIn } from '@/components/ui/Motion';
import { makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { removeBook, removeGame, setShelfStatus } from '@/lib/actions';
import { BookMeta, bookPage, fetchBook, loadBookExtras } from '@/lib/books';
import { ShelfExtras, mergeExtras } from '@/lib/extras';
import { countdown, fullDate } from '@/lib/format';
import { GameMeta, fetchGame, gamePage, loadGameExtras } from '@/lib/games';
import { Playtime, playtimeOf } from '@/lib/playtime';
import { bookFraction, gameFraction, shelfState } from '@/lib/shelf';
import { shareTitle } from '@/lib/share';
import { Book, Game } from '@/lib/types';
import { ShelfStatus, useLibrary } from '@/store/useLibrary';
import { useUi } from '@/store/useUi';

type Kind = 'book' | 'game';

/** Detail page for a book or a game: dates, where you are in it, and the rest of its series. */
export default function ShelfDetail({ kind, id }: { kind: Kind; id: string }) {
  const { t, i18n } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const haptics = useHaptics();
  const tracked = useLibrary((s) => (kind === 'book' ? s.books[id] : s.games[id])) as Book | Game | undefined;
  const [meta, setMeta] = useState<BookMeta | GameMeta>();
  const [error, setError] = useState(false);
  const isBook = kind === 'book';

  const load = useCallback(() => {
    if (!id) return;
    setError(false);
    const lib = useLibrary.getState();
    const done = (m: BookMeta | GameMeta, redirect?: string) => {
      // A Wikidata entry with an Open Library or Steam twin opens there, unless you added it as is.
      if (redirect && !(isBook ? lib.books[id] : lib.games[id])) return router.replace(`/${kind}/${redirect}` as never);
      if (redirect) return;
      setMeta(m);
      if (isBook && useLibrary.getState().books[id]) useLibrary.getState().updateBook({ ...(m as BookMeta), cover: m.cover ?? useLibrary.getState().books[id].cover });
      if (!isBook && useLibrary.getState().games[id]) useLibrary.getState().updateGame({ ...(m as GameMeta), cover: m.cover ?? useLibrary.getState().games[id].cover });
    };
    const fail = () => setError(!(isBook ? useLibrary.getState().books[id] : useLibrary.getState().games[id]));
    if (isBook)
      fetchBook(id, i18n.language)
        .then((d) => done(d.book, d.redirect))
        .catch(fail);
    else
      fetchGame(id, i18n.language)
        .then((d) => done(d.game, d.redirect))
        .catch(fail);
  }, [id, kind, isBook, i18n.language, router]);
  useEffect(load, [load]);

  const item = useMemo(() => tracked ?? (meta ? ({ ...meta, addedAt: 0 } as Book | Game) : undefined), [tracked, meta]);
  const state = item ? shelfState(item) : undefined;
  const upcoming = !!item?.releaseDate && item.releaseDate > Date.now();
  const book = isBook ? (item as Book | undefined) : undefined;
  const game = !isBook ? (item as Game | undefined) : undefined;

  // Extras load once the page knows what it shows, each source adding its part as it answers.
  const [extras, setExtras] = useState<ShelfExtras>({});
  const [seriesShown, setSeriesShown] = useState<string[]>([]);
  const extrasKey = item ? [item.id, item.wikidataId, isBook ? (item as Book).isbn : (item as Game).steamId, i18n.language].join('|') : '';
  useEffect(() => {
    setExtras({});
    if (!extrasKey || !item) return;
    let live = true;
    const emit = (part: ShelfExtras) => live && setExtras((prev) => mergeExtras(prev, part));
    if (isBook) loadBookExtras(item as Book, i18n.language, emit).catch(() => undefined);
    else loadGameExtras(item as Game, i18n.language, emit).catch(() => undefined);
    return () => {
      live = false;
    };
    // Only a new title (or language) reloads: progress changes keep what is there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extrasKey]);
  // How long it takes most people (HowLongToBeat), for games.
  const [playtime, setPlaytime] = useState<Playtime | null>(null);
  const gameTitle = game?.title;
  const gameYear = game?.year;
  useEffect(() => {
    setPlaytime(null);
    if (!gameTitle) return;
    let live = true;
    playtimeOf(gameTitle, gameYear)
      .then((p) => live && setPlaytime(p))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [gameTitle, gameYear]);

  const exclude = useMemo(() => [`/${kind}/${id}`, ...seriesShown], [kind, id, seriesShown]);

  const status = (s: ShelfStatus) => {
    setShelfStatus(kind, id, s);
    s === 'finished' ? haptics.success() : haptics.tap();
  };
  const add = (then?: 'started' | 'finished') => {
    if (!meta) return;
    const lib = useLibrary.getState();
    if (isBook) lib.addBook(meta as BookMeta);
    else lib.addGame(meta as GameMeta);
    // Played it already: finished, with the average playtime when you don't say otherwise.
    if (then) status(then);
    else {
      haptics.success();
      useUi.getState().showToast(t(upcoming ? 'toast.awaitMovie' : isBook ? 'toast.addedBook' : 'toast.addedGame', { title: meta.title }));
    }
  };
  const remove = () => (isBook ? removeBook(id) : removeGame(id));

  const metaLine = item
    ? (isBook
        ? [book!.authors.slice(0, 2).join(', '), book!.year, book!.pages ? t('book.pages', { count: book!.pages }) : undefined]
        : [game!.developer, game!.year]
      )
        .filter(Boolean)
        .join(' · ')
    : undefined;
  const fraction = book ? bookFraction(book) : game ? gameFraction(game) : 0;
  const link = item ? (isBook ? bookPage(book!) : gamePage(game!)) : undefined;
  const linkLabel = isBook ? (book?.source === 'ol' ? 'Open Library' : book?.source === 'gb' ? 'Google Books' : 'Wikidata') : game?.steamId ? 'Steam' : 'Wikidata';
  const links = useMemo(() => (link ? [{ label: linkLabel, url: link, icon: 'globe' as const }, ...(extras.links ?? []).filter((l) => l.label !== linkLabel)] : (extras.links ?? [])), [link, linkLabel, extras.links]);

  return (
    <DetailLayout kind={kind} title={item?.title} poster={item?.cover} backdrop={game?.backdrop} meta={metaLine} tags={isBook ? book?.subjects : game?.genres} loading={!item} error={error} onRetry={load}>
      {item && (
        <>
          <FadeIn index={3} style={styles.panel}>
            {item.releaseDate ? (
              <View style={styles.release}>
                <Text style={styles.label}>{upcoming ? t('movie.releases') : t(isBook ? 'book.published' : 'game.released')}</Text>
                <Text style={styles.date}>{fullDate(item.releaseDate)}</Text>
                {upcoming && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{countdown(item.releaseDate)}</Text>
                  </View>
                )}
              </View>
            ) : (
              !!item.year && item.year > new Date().getFullYear() - 1 && (
                <View style={styles.release}>
                  <Text style={styles.label}>{t('series.expected', { year: item.year })}</Text>
                </View>
              )
            )}
            {!!game?.platforms.length && (
              <Text style={styles.platforms} numberOfLines={2}>
                {game.platforms.join(' · ')}
              </Text>
            )}

            {!!game && !!(playtime?.main || playtime?.all) && (
              <View style={styles.release}>
                <Text style={styles.label}>{t('game.typical')}</Text>
                <Text style={styles.date}>
                  {[
                    playtime.main ? t('game.mainStory', { count: playtime.main }) : undefined,
                    playtime.all && playtime.all !== playtime.main ? t('game.allStyles', { count: playtime.all }) : undefined,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            )}

            {!tracked ? (
              // Two labelled actions don't fit side by side on a phone: stacked, the main one first.
              <View style={styles.stacked}>
                <Button label={upcoming ? t('movie.remind') : t('shelf.add')} icon={upcoming ? 'bell' : 'plus'} onPress={() => add()} disabled={!meta} style={styles.block} />
                {!upcoming && <Button label={t(isBook ? 'book.start' : 'game.start')} icon={isBook ? 'journal' : 'gamepad'} variant="secondary" onPress={() => add('started')} disabled={!meta} style={styles.block} />}
                {!upcoming && <Button label={t(isBook ? 'book.alreadyRead' : 'game.alreadyPlayed')} icon="check" variant="secondary" onPress={() => add('finished')} disabled={!meta} style={styles.block} />}
              </View>
            ) : state === 'upcoming' ? (
              <>
                <View style={styles.actions}>
                  <View style={styles.reminder}>
                    <Icon name="bell" size={18} color={palette.primaryText} strokeWidth={2} />
                    <Text style={styles.reminderText}>{t('movie.reminderSet')}</Text>
                  </View>
                  <Button label={t('common.remove')} icon="trash" variant="danger" iconOnly onPress={remove} />
                </View>
                <Text style={styles.hint}>{t('shelf.remindHint')}</Text>
              </>
            ) : state === 'want' ? (
              <>
                <View style={styles.actions}>
                  <Button label={t(isBook ? 'book.start' : 'game.start')} icon={isBook ? 'journal' : 'gamepad'} onPress={() => status('started')} style={{ flex: 1 }} />
                  <Button label={t('common.remove')} icon="trash" variant="danger" iconOnly onPress={remove} />
                </View>
                <Button label={t(isBook ? 'book.alreadyRead' : 'game.alreadyPlayed')} icon="check" variant="secondary" onPress={() => status('finished')} style={styles.block} />
              </>
            ) : state === 'started' ? (
              <>
                {book && (
                  <View style={{ gap: 8 }}>
                    <Text style={styles.label}>{t('book.yourPage')}</Text>
                    <Stepper
                      label={t('book.yourPage')}
                      value={book.page ?? 0}
                      max={book.pages}
                      bigStep={10}
                      suffix={book.pages ? t('book.ofPages', { count: book.pages }) : undefined}
                      onChange={(p) => useLibrary.getState().setBookPage(id, p)}
                    />
                  </View>
                )}
                {game && (
                  <View style={{ gap: 8 }}>
                    <Text style={styles.label}>{t('game.hours')}</Text>
                    <Stepper label={t('game.hours')} value={game.hours ?? 0} suffix={t('game.hoursUnit')} onChange={(hours) => useLibrary.getState().setGameProgress(id, { hours })} />
                    <Text style={styles.label}>{t('game.completion')}</Text>
                    <Stepper label={t('game.completion')} value={game.percent ?? 0} step={5} max={100} suffix="%" onChange={(percent) => useLibrary.getState().setGameProgress(id, { percent })} />
                  </View>
                )}
                {fraction > 0 && (
                  <View style={styles.progressRow}>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${Math.round(fraction * 100)}%` }]} />
                    </View>
                    <Text style={styles.percent}>{`${Math.round(fraction * 100)} %`}</Text>
                  </View>
                )}
                <View style={styles.actions}>
                  <Button label={t(isBook ? 'book.finished' : 'game.finished')} icon="check" onPress={() => status('finished')} style={{ flex: 1 }} />
                  <Button label={t('show.drop')} variant="secondary" onPress={() => status('dropped')} />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.done}>
                  {state === 'finished'
                    ? [t(isBook ? 'book.finishedOn' : 'game.finishedOn', { date: fullDate(item.finishedAt!) }), game?.hours ? t('game.hoursN', { count: game.hours }) : undefined].filter(Boolean).join(' · ')
                    : t('shelf.droppedOn', { date: fullDate(item.droppedAt!) })}
                </Text>
                <View style={styles.actions}>
                  <Button
                    label={state === 'finished' ? t(isBook ? 'book.again' : 'game.again') : t('show.resume')}
                    icon={state === 'finished' ? 'refresh' : 'play'}
                    variant="secondary"
                    onPress={() => {
                      if (state === 'finished') useLibrary.getState()[isBook ? 'setBookStatus' : 'setGameStatus'](id, 'want');
                      status('started');
                    }}
                    style={{ flex: 1 }}
                  />
                  <Button label={t('common.remove')} icon="trash" variant="danger" iconOnly onPress={remove} />
                </View>
              </>
            )}

            {tracked && state !== 'upcoming' && state !== 'want' && (
              <View style={styles.rate}>
                <Text style={styles.label}>{t('rating.yours')}</Text>
                <StarRating value={tracked.rating} onChange={(v) => useLibrary.getState()[isBook ? 'setBookRating' : 'setGameRating'](id, v)} size={24} />
              </View>
            )}
          </FadeIn>

          <ExtraLinks links={links} onShare={() => shareTitle(item.title, item.year, link)} />
          <ExtraScores scores={extras.scores ?? []} />
          <Synopsis text={item.overview} />
          <ExtraDetails extras={extras} kind={kind} />
          <CollectionLink kind={kind} item={item} />
          <SeriesRail qid={item.wikidataId} kind={kind} ordinal={item.series?.ordinal} fallback={extras.series} onShown={setSeriesShown} />
          <ExtraRails rails={extras.rails ?? []} exclude={exclude} />
        </>
      )}
    </DetailLayout>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  panel: { marginTop: 22, padding: 16, gap: 12, borderRadius: radii.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  release: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  label: { ...type.label },
  date: { ...fonts.semibold, fontSize: 14.5, color: palette.ink },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: palette.primaryTint },
  badgeText: { ...fonts.semibold, fontSize: 12, color: palette.primaryText },
  platforms: { ...fonts.medium, fontSize: 13, color: palette.inkSoft },
  actions: { flexDirection: 'row', gap: 10 },
  stacked: { gap: 10 },
  block: { alignSelf: 'stretch' },
  rate: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hint: { ...type.small, fontSize: 12.5 },
  done: { ...fonts.medium, fontSize: 14.5, color: palette.ink },
  reminder: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 25, backgroundColor: palette.primaryTint },
  reminderText: { ...fonts.semibold, fontSize: 15, color: palette.primaryText },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: palette.field, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: palette.primary },
  percent: { ...fonts.semibold, fontSize: 12.5, color: palette.inkSoft },
}));
