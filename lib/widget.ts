/** Keeps the home-screen widget in step with the library while the app runs (Android only). */
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { useLibrary } from '@/store/useLibrary';
import { GOALS_WIDGET, WIDGET_NAME, renderGoals, renderUpNext } from '@/widget/render';
import { usePrefs } from '@/store/usePrefs';

const DELAY = 1500;

export function startWidget() {
  if (Platform.OS !== 'android') return () => undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const update = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: renderUpNext }).catch(() => undefined);
      requestWidgetUpdate({ widgetName: GOALS_WIDGET, renderWidget: renderGoals }).catch(() => undefined);
    }, DELAY);
  };
  update();
  const unsub = useLibrary.subscribe((s, prev) => {
    if (s.shows !== prev.shows || s.movies !== prev.movies || s.books !== prev.books || s.games !== prev.games || s.settings !== prev.settings) update();
  });
  const unsubGoals = usePrefs.subscribe((s, prev) => {
    if (s.goals !== prev.goals) update();
  });
  return () => {
    clearTimeout(timer);
    unsub();
    unsubGoals();
  };
}
