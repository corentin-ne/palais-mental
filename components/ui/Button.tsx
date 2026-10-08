import { StyleProp, ViewStyle } from 'react-native';

import { IconName, glyph } from './Icon';
import { Button as SparkButton, ButtonVariant } from '@/spark';

interface Props {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  compact?: boolean;
  /** Square, glyph only (the label stays the accessible name): a secondary action beside a main one. */
  iconOnly?: boolean;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** The kit's button: the accent gradient for the main action, glass for the rest; 50 pt, 36 pt compact. */
export default function Button({ label, onPress, icon, variant = 'primary', compact, iconOnly, loading, disabled, style }: Props) {
  return (
    <SparkButton
      label={label}
      onPress={onPress}
      icon={icon ? glyph(icon) : undefined}
      variant={variant as ButtonVariant}
      size={compact ? 'sm' : 'lg'}
      iconOnly={iconOnly}
      busy={loading}
      disabled={disabled}
      style={style}
    />
  );
}
