import { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Icon from '@/components/ui/Icon';
import PressableScale from '@/components/ui/PressableScale';
import Stepper from '@/components/ui/Stepper';
import { FadeIn, Pop } from '@/components/ui/Motion';
import { makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { cheapestPrice } from '@/lib/games';
import { requestNotifications } from '@/lib/sync';
import { Game } from '@/lib/types';
import { Switch } from '@/spark';
import { useLibrary } from '@/store/useLibrary';

/** "Tell me under $20": the best price across stores now, and the price you'd buy it at. Checked on every sync. */
export default function PriceAlert({ game }: { game: Game }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const { palette } = useTheme();
  const haptics = useHaptics();
  const [deal, setDeal] = useState<{ price: number; url: string }>();
  useEffect(() => {
    if (game.steamId) cheapestPrice(game.steamId).then(setDeal);
  }, [game.steamId]);
  if (!game.steamId || game.finishedAt) return null;
  const on = !!game.priceAlert;
  const met = on && !!deal && deal.price <= game.priceAlert!;
  const toggle = (v: boolean) => {
    haptics.select();
    if (v) void requestNotifications();
    // A first price a little under today's best: what a sale usually takes off.
    useLibrary.getState().setPriceAlert(game.id, v ? Math.max(1, Math.floor((deal?.price ?? 20) * 0.7)) : undefined);
  };
  return (
    <FadeIn style={styles.card}>
      <View style={styles.head}>
        <Icon name="bell" size={18} color={palette.primaryText} strokeWidth={2} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('price.title')}</Text>
          {deal && (
            <PressableScale onPress={() => Linking.openURL(deal.url).catch(() => undefined)} accessibilityRole="link">
              <Text style={styles.now}>{t('price.now', { price: `$${deal.price.toFixed(2)}` })}</Text>
            </PressableScale>
          )}
        </View>
        <Switch value={on} onValueChange={toggle} label={t('price.title')} />
      </View>
      {on && (
        <>
          <Stepper label={t('price.under')} value={game.priceAlert!} bigStep={5} max={200} suffix="$" onChange={(n) => useLibrary.getState().setPriceAlert(game.id, Math.max(1, Math.round(n)))} />
          <Pop trigger={met}>
            <Text style={[styles.hint, met && { color: palette.successText }]}>{met ? t('price.met') : t('price.hint', { price: `$${game.priceAlert}` })}</Text>
          </Pop>
        </>
      )}
    </FadeIn>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  card: { marginTop: 14, padding: 16, gap: 12, borderRadius: radii.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { ...fonts.semibold, fontSize: 15, color: palette.ink },
  now: { ...fonts.medium, fontSize: 13, color: palette.primaryText },
  hint: { ...type.small, fontSize: 12.5 },
}));
