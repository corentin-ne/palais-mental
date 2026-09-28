import { ReactNode } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

import { makeStyles, useTheme } from '@/constants/theme';

interface Props {
  children?: ReactNode;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /** Inner layout (padding, gap…) — applied inside the clipped glass. */
  contentStyle?: StyleProp<ViewStyle>;
  strong?: boolean;
  elevated?: boolean;
}

/**
 * Frosted glass surface: real backdrop blur, a veil, and a bright hairline edge that
 * catches the light. In Aero the pane also carries a glossy specular sheen. The shadow lives on an outer view so the clip can't cut it.
 */
export default function Glass({ children, radius = 22, style, contentStyle, strong, elevated = true }: Props) {
  const { palette, shadow, glass } = useTheme();
  const styles = useStyles();
  return (
    <View style={[{ borderRadius: radius }, elevated && shadow.soft, style]}>
      <View style={[styles.clip, { borderRadius: radius }, flattenSize(contentStyle)]}>
        <BlurView
          intensity={Platform.OS === 'ios' ? glass.blur : glass.androidBlur}
          tint="light"
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: strong ? palette.glassStrong : palette.glass }]} />
        {/* Web paints absolutely positioned layers over static siblings: lift the content explicitly. */}
        <View style={[styles.content, contentStyle]}>{children}</View>
      </View>
    </View>
  );
}

/** The clip only needs the outer box size; layout (padding, direction, gap) belongs to the content. */
function flattenSize(style: StyleProp<ViewStyle>) {
  const s = StyleSheet.flatten(style) ?? {};
  return { width: s.width, height: s.height, flexShrink: s.flexShrink, maxHeight: s.maxHeight };
}

const useStyles = makeStyles(({ palette }) => ({
  content: { zIndex: 1 },
  clip: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.glassEdge,
  },
}));
