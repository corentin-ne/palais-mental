import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import Glass from '../Glass';
import Icon from '../Icon';
import PressableScale from '../PressableScale';
import { Gel } from './Gloss';
import { useTheme } from '@/constants/theme';
import { CATEGORY_SPECS } from '@/lib/itemVisuals';
import { mix } from '@/lib/color';
import { currentStreak, startOfDay } from '@/lib/stats';
import { CATEGORIES } from '@/lib/types';
import { usePalaceStore } from '@/store/usePalaceStore';
import { useUiStore } from '@/store/useUiStore';

const WEEK_GOAL = 7;

/**
 * Aero's journal header, in the spirit of the old desktop sidebar: a clock gadget that
 * greets you, a glossy weekly ring, a glass search bar and a row of category orbs.
 */
export default function AeroJournalHeader() {
  const { t, i18n } = useTranslation();
  const { palette, fonts } = useTheme();
  const openSearch = useUiStore((s) => s.openSearch);
  const events = usePalaceStore((s) => s.events);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(timer);
  }, []);

  const weekStart = startOfDay(Date.now()) - ((now.getDay() + 6) % 7) * 86_400_000;
  const week = events.filter((e) => e.ts >= weekStart).length;
  const streak = currentStreak(events);
  const hour = now.getHours();
  const greeting = t(hour < 5 ? 'aero.night' : hour < 12 ? 'aero.morning' : hour < 18 ? 'aero.afternoon' : 'aero.evening');
  const parts = new Intl.DateTimeFormat(i18n.language, { hour: 'numeric', minute: '2-digit' }).formatToParts(now);
  const time = parts.filter((p) => p.type !== 'dayPeriod').map((p) => p.value).join('').trim();
  const period = parts.find((p) => p.type === 'dayPeriod')?.value;
  const date = new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }).format(now);

  return (
    <View style={styles.wrap}>
      <View style={styles.gadgets}>
        <Glass radius={24} style={{ flex: 1.35 }} contentStyle={styles.clock}>
          <Text style={[styles.greeting, { fontFamily: fonts.semibold, color: palette.inkSoft }]}>{greeting}</Text>
          <Text style={[styles.time, { fontFamily: fonts.displayLight, color: palette.ink }]} numberOfLines={1} adjustsFontSizeToFit>
            {time}
            {period ? <Text style={styles.period}> {period}</Text> : null}
          </Text>
          <Text style={[styles.date, { fontFamily: fonts.body, color: palette.inkSoft }]} numberOfLines={1}>
            {date}
          </Text>
        </Glass>
        <Glass radius={24} style={{ flex: 1 }} contentStyle={styles.ringCard}>
          <Ring value={week} goal={WEEK_GOAL} />
          <View style={styles.ringText} pointerEvents="none">
            <Text style={[styles.ringValue, { fontFamily: fonts.displayLight, color: palette.ink }]}>{week}</Text>
          </View>
          <Text style={[styles.ringLabel, { fontFamily: fonts.medium, color: palette.inkSoft }]}>
            {t('aero.thisWeek')}
            {streak > 1 ? ` · ${t('aero.streak', { count: streak })}` : ''}
          </Text>
        </Glass>
      </View>

      <PressableScale onPress={() => openSearch('all')} depth={0.98}>
        <Glass radius={999} contentStyle={styles.search}>
          <Icon name="search" size={19} color={palette.inkSoft} />
          <Text style={{ fontFamily: fonts.body, fontSize: 16, color: palette.inkFaint }}>{t('journal.searchPlaceholder')}</Text>
        </Glass>
      </PressableScale>

      <View style={styles.orbs}>
        {CATEGORIES.map((c) => {
          const accent = CATEGORY_SPECS[c].accent;
          return (
            <PressableScale key={c} onPress={() => openSearch(c)} style={styles.orbCol} depth={0.9} accessibilityLabel={t(`categories.${c}`)}>
              <View style={styles.orb}>
                <Gel from={mix(accent, '#FFFFFF', 0.35)} to={mix(accent, '#000000', 0.12)} />
                <View style={{ zIndex: 1 }}>
                  <Icon name={c} size={22} color="#FFFFFF" strokeWidth={2} />
                </View>
              </View>
              <Text style={[styles.orbLabel, { fontFamily: fonts.medium, color: palette.inkSoft }]} numberOfLines={1}>
                {t(`categories.${c}`)}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

function Ring({ value, goal }: { value: number; goal: number }) {
  const size = 84;
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, value / goal);
  return (
    <Svg width={size} height={size}>
      <Defs>
        <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#7BE06A" />
          <Stop offset="1" stopColor="#1AA6EA" />
        </LinearGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.6)" strokeWidth={9} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="url(#ring)"
        strokeWidth={9}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${c * Math.max(0.001, frac)} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      {/* Specular glint on the ring */}
      <Circle cx={size / 2} cy={size / 2} r={r + 2.5} stroke="rgba(255,255,255,0.8)" strokeWidth={1.2} fill="none" strokeDasharray={`${c * 0.18} ${c}`} transform={`rotate(-150 ${size / 2} ${size / 2})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  gadgets: { flexDirection: 'row', gap: 12 },
  clock: { padding: 16, gap: 2, minHeight: 132, justifyContent: 'center' },
  greeting: { fontSize: 12.5, letterSpacing: 0.3 },
  time: { fontSize: 44, lineHeight: 52, letterSpacing: -1.5 },
  period: { fontSize: 16, letterSpacing: 0 },
  date: { fontSize: 13, textTransform: 'capitalize' },
  ringCard: { alignItems: 'center', justifyContent: 'center', padding: 12, gap: 6, minHeight: 132 },
  ringText: { position: 'absolute', top: 12, left: 0, right: 0, height: 84, alignItems: 'center', justifyContent: 'center' },
  ringValue: { fontSize: 28, letterSpacing: -1 },
  ringLabel: { fontSize: 11.5, textAlign: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, paddingHorizontal: 18 },
  orbs: { flexDirection: 'row', justifyContent: 'space-between' },
  orbCol: { alignItems: 'center', gap: 6, width: 54 },
  orb: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  orbLabel: { fontSize: 10.5 },
});
