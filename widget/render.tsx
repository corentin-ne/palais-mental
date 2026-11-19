import { Appearance } from 'react-native';
import type { WidgetInfo } from 'react-native-android-widget';

import i18n from '@/locales/i18n';
import { episodeCode, upNextShows } from '@/lib/progress';
import { useLibrary } from '@/store/useLibrary';
import { UpNextWidget } from './UpNextWidget';
import { GoalsWidget } from './GoalsWidget';
import { countsOf } from '@/lib/stats';
import { usePrefs } from '@/store/usePrefs';

export const WIDGET_NAME = 'UpNext';
export const GOALS_WIDGET = 'Goals';
/** Room for one row per ~70dp of height, below the title. */
const rowsFor = (height: number) => Math.max(1, Math.min(5, Math.floor((height - 40) / 58)));

/** Reads the library (loading it first when the app isn't running) before the widget draws or acts. */
export async function libraryReady() {
  if (!useLibrary.persist.hasHydrated()) await useLibrary.persist.rehydrate();
  if (!usePrefs.persist.hasHydrated()) await usePrefs.persist.rehydrate();
}

const darkOf = (appearance: string) => appearance === 'dark' || (appearance === 'system' && Appearance.getColorScheme() === 'dark');

/** The year's goals you set (films, books, games), with where you are. */
export function renderGoals(info: Pick<WidgetInfo, 'width'>) {
  const { shows, movies, books, games, settings } = useLibrary.getState();
  const goals = usePrefs.getState().goals;
  const year = new Date().getFullYear();
  const counts = countsOf({ shows, movies, books, games }, year);
  const labels = { movie: 'common.movies', book: 'common.books', game: 'common.games' } as const;
  const rows = (['movie', 'book', 'game'] as const).filter((k) => goals[k]).map((k) => ({ label: i18n.t(labels[k]), count: counts[k], goal: goals[k]! }));
  return <GoalsWidget rows={rows} width={info.width} title={i18n.t('stats.goals', { year })} empty={i18n.t('widget.noGoals')} dark={darkOf(settings.appearance)} accent={settings.accent || undefined} />;
}

export function renderUpNext(info: Pick<WidgetInfo, 'height'>) {
  const { shows, settings } = useLibrary.getState();
  const dark = settings.appearance === 'dark' || (settings.appearance === 'system' && Appearance.getColorScheme() === 'dark');
  const rows = upNextShows(shows)
    .slice(0, rowsFor(info.height))
    .map(({ show, next }) => ({
      showId: show.id,
      episodeId: next.id,
      uri: `palaismental://show/${show.tvmazeId}`,
      title: show.title,
      detail: [episodeCode(next), next.name].filter(Boolean).join(' · '),
    }));
  return <UpNextWidget rows={rows} title={i18n.t('upNext.title')} empty={i18n.t('upNext.caughtUp')} dark={dark} accent={settings.accent || undefined} />;
}
