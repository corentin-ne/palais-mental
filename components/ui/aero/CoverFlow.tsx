import { useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import CoverArt from '../CoverArt';
import PressableScale from '../PressableScale';
import { useTheme } from '@/constants/theme';
import { PalaceItem } from '@/lib/types';

const ITEM = 150;
const COVER_H = ITEM * 1.2;

/**
 * Cover Flow, as it was meant to be: covers turn toward you as they reach the centre,
 * with a mirror reflection on a glossy floor. The centred cover opens on tap.
 */
export default function CoverFlow({ items, onOpen }: { items: PalaceItem[]; onOpen: (item: PalaceItem) => void }) {
  const { width } = useWindowDimensions();
  const { fonts, palette } = useTheme();
  const x = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);
  const side = (Math.min(width, 760) - ITEM) / 2;
  if (!items.length) return null;
  const current = items[Math.min(index, items.length - 1)];

  return (
    <View style={styles.wrap}>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: side }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x } } }], {
          useNativeDriver: true,
          listener: (e: { nativeEvent: { contentOffset: { x: number } } }) =>
            setIndex(Math.max(0, Math.round(e.nativeEvent.contentOffset.x / ITEM))),
        })}
        style={styles.scroller}
      >
        {items.map((item, i) => {
          const input = [(i - 1) * ITEM, i * ITEM, (i + 1) * ITEM];
          const rotateY = x.interpolate({ inputRange: input, outputRange: ['58deg', '0deg', '-58deg'], extrapolate: 'clamp' });
          const scale = x.interpolate({ inputRange: input, outputRange: [0.8, 1, 0.8], extrapolate: 'clamp' });
          const opacity = x.interpolate({ inputRange: [(i - 3) * ITEM, i * ITEM, (i + 3) * ITEM], outputRange: [0.35, 1, 0.35], extrapolate: 'clamp' });
          return (
            <Animated.View key={item.id} style={{ width: ITEM, alignItems: 'center', opacity, transform: [{ perspective: 700 }, { rotateY }, { scale }] }}>
              <PressableScale onPress={() => onOpen(item)} depth={0.97}>
                <CoverArt uri={item.coverUrl} title={item.title} category={item.category} width={ITEM - 20} aspect={(ITEM - 20) / COVER_H} radius={6} elevated={false} />
              </PressableScale>
              {/* Reflection on the glossy floor */}
              <View style={[styles.reflection, { height: COVER_H * 0.38 }]} pointerEvents="none">
                <View style={{ transform: [{ scaleY: -1 }] }}>
                  <CoverArt uri={item.coverUrl} title={item.title} category={item.category} width={ITEM - 20} aspect={(ITEM - 20) / COVER_H} radius={6} elevated={false} />
                </View>
                <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
                  <Defs>
                    <LinearGradient id={`fade${i}`} x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor="#E4F5FD" stopOpacity={0.55} />
                      <Stop offset="0.8" stopColor="#E4F5FD" stopOpacity={1} />
                    </LinearGradient>
                  </Defs>
                  <Rect x="0" y="0" width="100%" height="100%" fill={`url(#fade${i})`} />
                </Svg>
              </View>
            </Animated.View>
          );
        })}
      </Animated.ScrollView>
      <View style={styles.caption}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: palette.ink }} numberOfLines={1}>
          {current.title}
        </Text>
        {!!current.creator && (
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: palette.inkSoft }} numberOfLines={1}>
            {current.creator}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4, marginHorizontal: -20 },
  scroller: { flexGrow: 0 },
  reflection: { overflow: 'hidden', marginTop: 4, opacity: 0.9 },
  caption: { alignItems: 'center', gap: 1, paddingHorizontal: 40 },
});
