import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import DetailLayout, { CastRail, Synopsis } from '@/components/media/DetailLayout';
import Extras, { Similar } from '@/components/media/Extras';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import StarRating from '@/components/ui/StarRating';
import { FadeIn, Pop } from '@/components/ui/Motion';
import { makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { Extras as ExtrasData, MovieDetails, fetchMovie, fetchMovieExtras } from '@/lib/api';
import { removeMovie } from '@/lib/actions';
import { countdown, fullDate, runtime } from '@/lib/format';
import { useLibrary } from '@/store/useLibrary';
import { useUi } from '@/store/useUi';

export default function MovieScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const haptics = useHaptics();
  const tracked = useLibrary((s) => s.movies[id]);
  const tmdbKey = useLibrary((s) => s.settings.tmdbKey) || undefined;
  const [details, setDetails] = useState<MovieDetails>();
  const [error, setError] = useState(false);
  const [extras, setExtras] = useState<ExtrasData>();

  const load = useCallback(() => {
    setError(false);
    const known = useLibrary.getState().movies[id];
    const hint = known ? { kind: 'movie' as const, id, title: known.title, year: known.year, poster: known.poster, releaseDate: known.releaseDate } : undefined;
    fetchMovie(id, { tmdbKey, lang: i18n.language, hint })
      .then((d) => {
        setDetails(d);
        if (useLibrary.getState().movies[id]) useLibrary.getState().updateMovie({ ...d.movie, poster: d.movie.poster ?? known?.poster });
      })
      .catch(() => setError(!useLibrary.getState().movies[id]));
  }, [id, tmdbKey, i18n.language]);
  useEffect(load, [load]);

  const movie = useMemo(() => tracked ?? details?.movie, [tracked, details]);
  const source = movie?.source;
  const sourceId = movie?.sourceId;
  const imdbId = movie?.imdbId;
  useEffect(() => {
    if (!source || !sourceId) return;
    fetchMovieExtras({ source, sourceId, imdbId }, { tmdbKey, lang: i18n.language }).then(setExtras);
  }, [source, sourceId, imdbId, tmdbKey, i18n.language]);
  const upcoming = !!movie?.releaseDate && movie.releaseDate > Date.now();
  const watched = !!tracked?.watchedAt;

  const add = (markWatched: boolean) => {
    if (!details) return;
    useLibrary.getState().addMovie(details.movie);
    if (markWatched) useLibrary.getState().setMovieWatched(id, true);
    haptics.success();
    useUi.getState().showToast(t(markWatched ? 'toast.watchedMovie' : upcoming ? 'toast.awaitMovie' : 'toast.addedMovie', { title: details.movie.title }));
  };
  const toggleWatched = () => {
    useLibrary.getState().setMovieWatched(id, !watched);
    watched ? haptics.tap() : haptics.success();
  };

  const meta = movie ? [movie.year, runtime(movie.runtime), movie.director].filter(Boolean).join(' · ') : undefined;

  return (
    <DetailLayout kind="movie" title={movie?.title} poster={movie?.poster} backdrop={movie?.backdrop} meta={meta} tags={movie?.genres} loading={!movie} error={error} onRetry={load}>
      {movie && (
        <>
          <FadeIn index={3} style={styles.panel}>
            {movie.releaseDate && (
              <View style={styles.release}>
                <Text style={styles.releaseLabel}>{upcoming ? t('movie.releases') : t('movie.released')}</Text>
                <Text style={styles.releaseDate}>{fullDate(movie.releaseDate)}</Text>
                {upcoming && (
                  <View style={styles.countdown}>
                    <Text style={styles.countdownText}>{countdown(movie.releaseDate)}</Text>
                  </View>
                )}
              </View>
            )}
            {tracked ? (
              <View style={styles.actions}>
                {upcoming && !watched ? (
                  <View style={styles.reminder}>
                    <Icon name="bell" size={18} color={palette.primaryText} strokeWidth={2} />
                    <Text style={styles.reminderText}>{t('movie.reminderSet')}</Text>
                  </View>
                ) : (
                  <Pop trigger={watched} style={{ flex: 1 }}>
                    <Button
                      label={watched ? t('movie.watched') : t('movie.markWatched')}
                      icon={watched ? 'check' : 'eye'}
                      variant={watched ? 'secondary' : 'primary'}
                      onPress={toggleWatched}
                      style={{ alignSelf: 'stretch' }}
                    />
                  </Pop>
                )}
                <Button label={t('common.remove')} icon="trash" variant="danger" iconOnly onPress={() => removeMovie(id)} />
              </View>
            ) : (
              // Two labelled actions don't fit side by side on a phone: stacked, the main one first.
              <View style={{ gap: 10 }}>
                <Button label={upcoming ? t('movie.remind') : t('movie.addWatchlist')} icon={upcoming ? 'bell' : 'plus'} onPress={() => add(false)} disabled={!details} style={{ alignSelf: 'stretch' }} />
                {!upcoming && <Button label={t('movie.seenIt')} icon="check" variant="secondary" onPress={() => add(true)} disabled={!details} style={{ alignSelf: 'stretch' }} />}
              </View>
            )}
            {upcoming && !watched && <Text style={styles.hint}>{t('movie.remindHint')}</Text>}
            {tracked && !(upcoming && !watched) && (
              <View style={styles.rate}>
                <Text style={styles.releaseLabel}>{t('rating.yours')}</Text>
                <StarRating value={tracked.rating} onChange={(v) => useLibrary.getState().setMovieRating(id, v)} size={24} />
              </View>
            )}
          </FadeIn>
          <Extras kind="movie" title={movie.title} year={movie.year} imdbId={movie.imdbId} extras={extras} />
          <Synopsis text={movie.overview} />
          <CastRail cast={details?.cast ?? []} />
          <Similar kind="movie" extras={extras} />
        </>
      )}
    </DetailLayout>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  panel: { marginTop: 22, padding: 16, gap: 12, borderRadius: radii.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  release: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  releaseLabel: { ...type.label },
  releaseDate: { ...fonts.semibold, fontSize: 14.5, color: palette.ink },
  countdown: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: palette.primaryTint },
  countdownText: { ...fonts.semibold, fontSize: 12, color: palette.primaryText },
  actions: { flexDirection: 'row', gap: 10 },
  rate: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hint: { ...type.small, fontSize: 12.5 },
  reminder: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 25, backgroundColor: palette.primaryTint },
  reminderText: { ...fonts.semibold, fontSize: 15, color: palette.primaryText },
}));
