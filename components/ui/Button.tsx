import { StyleProp, ViewStyle } from 'react-native';

import { IconName, glyph } from './Icon';
import { Button as SparkButton, ButtonVariant } from '@/spark';

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

/** The kit's button: the accent gradient for the main action, glass for the rest; 50 pt, 36 pt compact. */
export default function Button({ label, onPress, icon, variant = 'primary', compact, loading, disabled, style }: Props) {
  return (
    <SparkButton
      label={label}
      onPress={onPress}
      icon={icon ? glyph(icon) : undefined}
      variant={variant as ButtonVariant}
      size={compact ? 'sm' : 'lg'}
      busy={loading}
      disabled={disabled}
      style={style}
    />
  );
}
