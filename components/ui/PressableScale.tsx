import { ReactNode } from 'react';
import { PressableProps, StyleProp, ViewStyle } from 'react-native';

import { Press } from '@/spark';

interface Props extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** How far the control sinks when pressed (the kit's 0.97 by default). */
  depth?: number;
}

/** The kit's press feedback: a spring down and back, transform only. */
export default function PressableScale(props: Props) {
  return <Press {...props} />;
}
