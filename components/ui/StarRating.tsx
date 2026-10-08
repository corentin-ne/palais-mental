import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Icon from './Icon';
import PressableScale from './PressableScale';
import { useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';

interface Props {
  /** 1–10: two points per star. */
  value?: number;
  onChange: (value: number | undefined) => void;
  size?: number;
}

/** Five stars. Tap a star for a full star, again for a half, a third time to clear. */
export default function StarRating({ value, onChange, size = 26 }: Props) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const haptics = useHaptics();
  return (
    <View style={{ flexDirection: 'row', gap: 4 }} accessibilityRole="adjustable" accessibilityLabel={t('rating.label')} accessibilityValue={{ min: 0, max: 10, now: value ?? 0 }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const full = (value ?? 0) >= i * 2;
        const half = !full && value === i * 2 - 1;
        return (
          <PressableScale
            key={i}
            hitSlop={4}
            accessibilityLabel={t('rating.stars', { count: i })}
            onPress={() => {
              haptics.select();
              onChange(value === i * 2 ? i * 2 - 1 : value === i * 2 - 1 ? undefined : i * 2);
            }}
          >
            <View style={{ width: size, height: size }}>
              <Icon name="star" size={size} color={full || half ? palette.primary : palette.inkFaint} />
              {(full || half) && (
                <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: full ? size : size / 2, overflow: 'hidden' }}>
                  <Icon name="starFill" size={size} color={palette.primary} />
                </View>
              )}
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Read-only rating as a small pill: "★ 4.5". */
export function StarBadge({ value }: { value: number }) {
  const { palette, fonts } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: palette.primaryTint }}>
      <Icon name="starFill" size={11} color={palette.primary} />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: palette.primary }}>{(value / 2).toLocaleString(undefined, { maximumFractionDigits: 1 })}</Text>
    </View>
  );
}
