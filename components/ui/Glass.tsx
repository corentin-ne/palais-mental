import { ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';

import { Glass as SparkGlass } from '@/spark';

interface Props {
  children?: ReactNode;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /** Inner layout (padding, gap…). */
  contentStyle?: StyleProp<ViewStyle>;
  strong?: boolean;
  elevated?: boolean;
}

/** A floating glass layer (tab bar, toasts): the kit's blurred glass with its light edge and shadow. */
export default function Glass({ children, radius = 22, style, contentStyle, strong, elevated = true }: Props) {
  return (
    <SparkGlass blur tone={strong ? 'strong' : 'default'} radius={radius} elevated={elevated ? 'lg' : false} style={[style, contentStyle]}>
      {children}
    </SparkGlass>
  );
}
