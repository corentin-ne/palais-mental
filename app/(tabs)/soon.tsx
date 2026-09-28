import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import CoverArt from '@/components/ui/CoverArt';
import Icon from '@/components/ui/Icon';
import PressableScale from '@/components/ui/PressableScale';
import { Button } from '@/components/ui/Controls';
import { FadeIn } from '@/components/ui/Motion';
import { makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { Upcoming, getUpcoming, notificationPermission, refreshEpisodes, requestNotifications, scheduleReleaseNotifications } from '@/lib/releases';
import { CATEGORY_SPECS } from '@/lib/itemVisuals';
import { usePalaceStore } from '@/store/usePalaceStore';
import { useUiStore } from '@/store/useUiStore';

const DAY = 86_400_000;

/**
 * The one place where time matters: what is coming out next among the things in your
 * palace. Nothing here asks you to log anything.
 */
export default function SoonScreen() {
  const { t, i18n } = useTranslation();
  const { type, palette } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const items = usePalaceStore((s) => s.items);
  const selectItem = usePalaceStore((s) => s.selectItem);
  const openSearch = useUiStore((s) => s.openSearch);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>('granted');
  const [refreshing, setRefreshing] = useState(false);

  const upcoming = useMemo(() => getUpcoming(items), [items]);
  useEffect(() => {
    notificationPermission().then(setPermission);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshEpisodes(true);
    await scheduleReleaseNotifications();
    setRefreshing(false);
  }, []);

  const week = upcoming.filter((u) => u.date < Date.now() + 7 * DAY);
  const later = upcoming.filter((u) => u.date >= Date.now() + 7 * DAY);
  let row = 0;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.inkSoft} />}
    >
      <View style={{ gap: 4 }}>
        <Text style={type.display}>{t('soon.title')}</Text>
        <Text style={type.serif}>{t('soon.subtitle')}</Text>
      </View>

      {/* Soft ask: explain the value in context before the system prompt appears. */}
      {Platform.OS !== 'web' && permission === 'undetermined' && upcoming.length > 0 && (
        <FadeIn style={styles.ask}>
          <View style={styles.askIcon}>
            <Icon name="bell" size={20} color={palette.onInk} />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={type.bodyMedium}>{t('soon.askTitle')}</Text>
            <Text style={type.small}>{t('soon.askBody')}</Text>
            <View style={{ alignSelf: 'flex-start' }}>
              <Button
                label={t('soon.askCta')}
                compact
                onPress={async () => {
                  const ok = await requestNotifications();
                  haptics.tap();
                  setPermission(ok ? 'granted' : 'denied');
                  if (ok) scheduleReleaseNotifications();
                }}
              />
            </View>
          </View>
        </FadeIn>
      )}

      {upcoming.length === 0 ? (
        <FadeIn style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Icon name="bell" size={28} color={palette.inkSoft} />
          </View>
          <Text style={[type.title, { textAlign: 'center' }]}>{t('soon.emptyTitle')}</Text>
          <Text style={[type.small, { textAlign: 'center', maxWidth: 300 }]}>{t('soon.emptyBody')}</Text>
          <Button label={t('soon.emptyCta')} icon="search" compact onPress={() => openSearch('series')} />
        </FadeIn>
      ) : (
        <>
          {week.length > 0 && <Text style={type.label}>{t('soon.thisWeek')}</Text>}
          {week.map((u) => (
            <FadeIn key={`${u.item.id}-${u.kind}`} index={row++}>
              <Row u={u} lng={i18n.language} onPress={() => selectItem(u.item.id)} />
            </FadeIn>
          ))}
          {later.length > 0 && <Text style={[type.label, { marginTop: 8 }]}>{t('soon.later')}</Text>}
          {later.map((u) => (
            <FadeIn key={`${u.item.id}-${u.kind}`} index={row++}>
              <Row u={u} lng={i18n.language} onPress={() => selectItem(u.item.id)} />
            </FadeIn>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function Row({ u, lng, onPress }: { u: Upcoming; lng: string; onPress: () => void }) {
  const { t } = useTranslation();
  const { type } = useTheme();
  const styles = useStyles();
  const d = new Date(u.date);
  const days = Math.round((startOfDay(u.date) - startOfDay(Date.now())) / DAY);
  const when =
    days <= 0 ? t('soon.today') : days === 1 ? t('soon.tomorrow') : new Intl.RelativeTimeFormat(lng, { numeric: 'auto' }).format(days, 'day');
  const accent = CATEGORY_SPECS[u.item.category].accent;
  return (
    <PressableScale onPress={onPress} style={styles.row} depth={0.98}>
      <View style={[styles.date, days <= 0 && { backgroundColor: accent }]}>
        <Text style={[styles.dateDay, days <= 0 && styles.dateOn]}>{d.getDate()}</Text>
        <Text style={[styles.dateMonth, days <= 0 && styles.dateOn]}>{new Intl.DateTimeFormat(lng, { month: 'short' }).format(d)}</Text>
      </View>
      <CoverArt uri={u.item.coverUrl} title={u.item.title} category={u.item.category} width={46} aspect={2 / 3} radius={6} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.title} numberOfLines={1}>
          {u.item.title}
        </Text>
        <Text style={type.small} numberOfLines={1}>
          {u.kind === 'episode' ? t('soon.episodeCode', { season: u.season, episode: u.episode }) : t(`soon.release.${u.item.category}`)}
        </Text>
      </View>
      <Text style={[styles.when, days <= 0 && { color: accent }]}>{when}</Text>
    </PressableScale>
  );
}

const startOfDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const useStyles = makeStyles(({ palette, fonts, radii }) => ({
  root: { flex: 1, backgroundColor: palette.screen },
  content: { paddingHorizontal: 20, gap: 14, maxWidth: 720, width: '100%', alignSelf: 'center' },
  ask: { flexDirection: 'row', gap: 14, backgroundColor: palette.surface, borderRadius: radii.lg, padding: 16, borderWidth: 1, borderColor: palette.hairline },
  askIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.field },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  date: { width: 46, height: 52, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.field },
  dateDay: { fontFamily: fonts.bold, fontSize: 19, letterSpacing: -0.5, color: palette.ink, fontVariant: ['tabular-nums'] },
  dateMonth: { fontFamily: fonts.semibold, fontSize: 10.5, color: palette.inkSoft, textTransform: 'uppercase' },
  dateOn: { color: '#FFFFFF' },
  title: { fontFamily: fonts.semibold, fontSize: 16, letterSpacing: -0.2, color: palette.ink },
  when: { fontFamily: fonts.medium, fontSize: 13, color: palette.inkSoft },
}));
