import { useRef } from 'react';
import { GestureResponderEvent, StyleSheet, View, useWindowDimensions } from 'react-native';

import OceanWorld from '@/components/3d/ocean/OceanWorld';
import SafeBoundary from '@/components/ui/SafeBoundary';
import { makeStyles } from '@/constants/theme';
import { dragWater, setDragging, tapWater } from '@/lib/oceanSignals';

/**
 * Your collection as clear water. The view is free: drag to look around, tap to ripple the
 * water. What you log falls into it as a drop. The tab bar is the only interface here.
 */
export default function PalaceScreen() {
  const styles = useStyles();
  const screen = useWindowDimensions();
  const touch = useRef({ x: 0, y: 0, lastX: 0, lastY: 0, t: 0, moved: 0 });

  const onGrant = (e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    touch.current = { x: pageX, y: pageY, lastX: pageX, lastY: pageY, t: Date.now(), moved: 0 };
    setDragging(true);
  };
  const onMove = (e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    const c = touch.current;
    dragWater(pageX - c.lastX, pageY - c.lastY);
    c.moved = Math.max(c.moved, Math.hypot(pageX - c.x, pageY - c.y));
    c.lastX = pageX;
    c.lastY = pageY;
  };
  const onRelease = (e: GestureResponderEvent) => {
    setDragging(false);
    const { pageX, pageY } = e.nativeEvent;
    if (touch.current.moved < 8 && Date.now() - touch.current.t < 400) {
      tapWater((pageX / screen.width) * 2 - 1, 1 - (pageY / screen.height) * 2);
    }
  };

  return (
    <View style={styles.root}>
      <View
        style={StyleSheet.absoluteFill}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={onGrant}
        onResponderMove={onMove}
        onResponderRelease={onRelease}
        onResponderTerminate={() => setDragging(false)}
      >
        <SafeBoundary label="palace" fallback={null}>
          <OceanWorld />
        </SafeBoundary>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ palette }) => ({
  root: { flex: 1, backgroundColor: palette.bg },
}));
