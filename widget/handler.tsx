import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { flushStorage } from '@/lib/storage';
import { useLibrary } from '@/store/useLibrary';
import { WIDGET_NAME, libraryReady, renderUpNext } from './render';

/** Runs in the background when the widget is added, resized, refreshed or tapped. */
export async function widgetTaskHandler({ widgetInfo, widgetAction, clickAction, clickActionData, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetInfo.widgetName !== WIDGET_NAME || widgetAction === 'WIDGET_DELETED') return;
  await libraryReady();
  if (widgetAction === 'WIDGET_CLICK' && clickAction === 'TICK') {
    const showId = String(clickActionData?.showId ?? '');
    const episodeId = Number(clickActionData?.episodeId);
    if (showId && Number.isFinite(episodeId)) {
      useLibrary.getState().setEpisodes(showId, [episodeId], true);
      // The app may not be running: write now rather than when it would have settled.
      await flushStorage();
    }
  }
  renderWidget(renderUpNext(widgetInfo));
}
