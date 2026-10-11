import { Appearance } from 'react-native';
import type { WidgetInfo } from 'react-native-android-widget';

import i18n from '@/locales/i18n';
import { episodeCode, upNextShows } from '@/lib/progress';
import { useLibrary } from '@/store/useLibrary';
import { UpNextWidget } from './UpNextWidget';

export const WIDGET_NAME = 'UpNext';
/** Room for one row per ~70dp of height, below the title. */
const rowsFor = (height: number) => Math.max(1, Math.min(5, Math.floor((height - 40) / 58)));

/** Reads the library (loading it first when the app isn't running) before the widget draws or acts. */
export async function libraryReady() {
  if (!useLibrary.persist.hasHydrated()) await useLibrary.persist.rehydrate();
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
