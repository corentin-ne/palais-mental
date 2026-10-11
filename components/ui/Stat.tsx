import { Text } from 'react-native';

import Icon, { IconName } from './Icon';
import { FadeIn, useCountUp } from './Motion';
import { makeStyles, useTheme } from '@/constants/theme';

/** One number on a glass tile: counts up to `value`, or shows `text` as is (durations). Lay several out in a wrapping row. */
export default function Stat({ icon, value, text, label, index }: { icon: IconName; value?: number; text?: string; label: string; index: number }) {
  const styles = useStyles();
  const { palette } = useTheme();
  const shown = useCountUp(value ?? 0);
  return (
    <FadeIn index={index} style={styles.stat}>
      <Icon name={icon} size={18} color={palette.primaryText} />
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {text ?? Math.round(shown).toLocaleString()}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </FadeIn>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  stat: { flexGrow: 1, flexBasis: '45%', padding: 16, gap: 6, borderRadius: radii.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  value: { ...fonts.bold, fontSize: 26, letterSpacing: -0.8, color: palette.ink },
  label: { ...type.small },
}));
