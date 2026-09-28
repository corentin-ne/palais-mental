import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import PressableScale from './PressableScale';
import { StyleName, themes, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { usePalaceStore } from '@/store/usePalaceStore';

/** Two little windows onto the two experiences; tap to switch instantly. */
export default function StylePicker() {
  const { t } = useTranslation();
  const { palette, fonts } = useTheme();
  const haptics = useHaptics();
  const style = usePalaceStore((s) => s.settings.style ?? 'editorial');
  const setSetting = usePalaceStore((s) => s.setSetting);
  const options: StyleName[] = ['editorial', 'aero'];
  return (
    <View style={styles.row}>
      {options.map((name) => {
        const active = name === style;
        return (
          <PressableScale
            key={name}
            onPress={() => {
              haptics.select();
              setSetting('style', name);
            }}
            accessibilityState={{ selected: active }}
            style={[styles.card, { borderColor: active ? palette.primary : 'transparent' }]}
            depth={0.96}
          >
            <View style={styles.swatch}>{name === 'aero' ? <AeroSwatch /> : <EditorialSwatch />}</View>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: palette.ink }}>{t(`style.${name}`)}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: palette.inkSoft }}>{t(`style.${name}Hint`)}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

function EditorialSwatch() {
  const ink = themes.editorial.palette.ink;
  return (
    <Svg width="100%" height="100%" viewBox="0 0 140 90" preserveAspectRatio="xMidYMid slice">
      <Rect width="140" height="90" fill="#FAF9F6" />
      <Rect x="12" y="14" width="46" height="8" rx="2" fill={ink} />
      <Rect x="12" y="28" width="30" height="4" rx="2" fill="rgba(22,20,18,0.3)" />
      <Rect x="12" y="44" width="22" height="33" rx="3" fill="#E8A598" />
      <Rect x="40" y="44" width="22" height="33" rx="3" fill="#9CC3D5" />
      <Rect x="68" y="44" width="22" height="33" rx="3" fill="#E6CF8B" />
      <Rect x="96" y="44" width="22" height="33" rx="3" fill="#B7A6D6" />
    </Svg>
  );
}

function AeroSwatch() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 140 90" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="sw-sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#3FA9EA" />
          <Stop offset="0.7" stopColor="#CFEFFC" />
          <Stop offset="1" stopColor="#E9F9EC" />
        </LinearGradient>
        <LinearGradient id="sw-gel" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#7AD6FF" />
          <Stop offset="1" stopColor="#0B69BF" />
        </LinearGradient>
      </Defs>
      <Rect width="140" height="90" fill="url(#sw-sky)" />
      <Rect x="12" y="14" width="70" height="30" rx="9" fill="rgba(255,255,255,0.5)" stroke="#FFFFFF" strokeWidth="1" />
      <Rect x="12" y="14" width="70" height="13" rx="9" fill="rgba(255,255,255,0.45)" />
      <Circle cx="112" cy="30" r="13" fill="url(#sw-gel)" stroke="#FFFFFF" strokeWidth="1.2" />
      <Rect x="103" y="19" width="18" height="7" rx="3.5" fill="rgba(255,255,255,0.65)" />
      <Circle cx="30" cy="68" r="9" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.9)" strokeWidth="1" />
      <Circle cx="58" cy="74" r="5" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.9)" strokeWidth="1" />
      <Circle cx="120" cy="70" r="7" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.9)" strokeWidth="1" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  card: { flex: 1, gap: 4, padding: 8, borderRadius: 20, borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.5)' },
  swatch: { height: 84, borderRadius: 14, overflow: 'hidden', marginBottom: 6 },
});
