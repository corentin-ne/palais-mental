/** Keeps the home-screen widget in step with the library while the app runs (Android only). */
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { useLibrary } from '@/store/useLibrary';
import { WIDGET_NAME, renderUpNext } from '@/widget/render';

const DELAY = 1500;

export function startWidget() {
  if (Platform.OS !== 'android') return () => undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const update = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: renderUpNext }).catch(() => undefined);
    }, DELAY);
  };
  update();
  const unsub = useLibrary.subscribe((s, prev) => {
    if (s.shows !== prev.shows || s.settings !== prev.settings) update();
  });
  return () => {
    clearTimeout(timer);
    unsub();
  };
}
