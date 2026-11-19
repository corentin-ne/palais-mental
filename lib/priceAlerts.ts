/** Games you asked to hear about at a price: checked on each sync, a notification once the best deal gets there. */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import i18n from '@/locales/i18n';
import { cheapestPrice } from './games';
import { useLibrary } from '@/store/useLibrary';

export async function checkPriceAlerts() {
  const games = Object.values(useLibrary.getState().games).filter((g) => g.priceAlert && g.steamId && !g.finishedAt && !g.droppedAt);
  if (!games.length) return;
  const allowed =
    Platform.OS !== 'web' &&
    useLibrary.getState().settings.notifications &&
    (await Notifications.getPermissionsAsync().then((p) => p.status === 'granted').catch(() => false));
  for (const g of games) {
    const deal = await cheapestPrice(g.steamId!);
    if (!deal) continue;
    const now = useLibrary.getState().games[g.id];
    if (!now?.priceAlert) continue;
    // At or under your price, and cheaper than the deal already announced (or the first one).
    if (deal.price <= now.priceAlert && (now.priceAlerted == null || deal.price < now.priceAlerted)) {
      useLibrary.getState().setPriceAlert(g.id, now.priceAlert, deal.price);
      if (allowed)
        await Notifications.scheduleNotificationAsync({
          content: { title: i18n.t('price.notifyTitle', { title: g.title }), body: i18n.t('price.notifyBody', { price: `$${deal.price.toFixed(2)}`, target: `$${now.priceAlert}` }), data: { url: `/game/${g.id}` } },
          trigger: null,
        }).catch(() => undefined);
    } else if (now.priceAlerted != null && deal.price > now.priceAlert) {
      // The deal is over: the next one will be announced again.
      useLibrary.getState().setPriceAlert(g.id, now.priceAlert, null);
    }
  }
}
