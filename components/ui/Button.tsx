import { ActivityIndicator, StyleProp, Text, ViewStyle } from 'react-native';

import Icon, { IconName } from './Icon';
import PressableScale from './PressableScale';
import { makeStyles, useTheme } from '@/constants/theme';

interface Props {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  compact?: boolean;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function Button({ label, onPress, icon, variant = 'primary', compact, loading, disabled, style }: Props) {
  const { palette } = useTheme();
  const styles = useStyles();
  const fg = variant === 'primary' ? palette.onInk : variant === 'danger' ? palette.danger : palette.ink;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={label}
      style={[styles.base, compact && styles.compact, styles[variant], style]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : icon && <Icon name={icon} size={compact ? 16 : 18} color={fg} strokeWidth={2.1} />}
      <Text style={[styles.label, compact && styles.labelCompact, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

const useStyles = makeStyles(({ palette, fonts, shadow }) => ({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, paddingHorizontal: 22, borderRadius: 25 },
  compact: { height: 38, paddingHorizontal: 16, borderRadius: 19, gap: 6 },
  primary: { backgroundColor: palette.primary, ...shadow.lifted, shadowOpacity: 0.16 },
  secondary: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  ghost: { backgroundColor: palette.field },
  danger: { backgroundColor: palette.dangerTint },
  label: { fontFamily: fonts.semibold, fontSize: 15, letterSpacing: -0.1 },
  labelCompact: { fontSize: 13.5 },
}));
