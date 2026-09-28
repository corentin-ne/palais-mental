import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import Icon from './Icon';
import { fonts, radii, shadow } from '@/constants/theme';
import { CATEGORY_SPECS, hashString } from '@/lib/itemVisuals';
import { CategoryId } from '@/lib/types';

/** Natural artwork proportions per collection (width / height). */
export const COVER_ASPECT: Record<CategoryId, number> = {
  movies: 2 / 3,
  series: 1,
  music: 1,
  books: 2 / 3,
  boardgames: 1,
  videogames: 3 / 4,
};

interface Props {
  uri?: string;
  title: string;
  category: CategoryId;
  width: number;
  /** Override the category's natural aspect (grids use one shape for a clean rhythm). */
  aspect?: number;
  radius?: number;
  elevated?: boolean;
}

/**
 * Artwork for any memory. Real covers load with a soft fade; anything without one
 * gets a generated cover: a gradient in the collection's palette, the title set in
 * serif italic, and the collection's mark.
 */
export default function CoverArt({ uri, title, category, width, aspect, radius = radii.sm, elevated = true }: Props) {
  const [failed, setFailed] = useState(false);
  const height = width / (aspect ?? COVER_ASPECT[category]);
  const showImage = !!uri && !failed;
  return (
    <View style={[{ width, height, borderRadius: radius }, elevated && shadow.cover]}>
      <View style={[styles.clip, { borderRadius: radius }]}>
        {showImage ? (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={220}
            recyclingKey={uri}
            onError={() => setFailed(true)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Generated title={title} category={category} width={width} height={height} />
        )}
      </View>
    </View>
  );
}

function Generated({ title, category, width, height }: { title: string; category: CategoryId; width: number; height: number }) {
  const spec = CATEGORY_SPECS[category];
  const h = hashString(title || category);
  const a = spec.palette[h % spec.palette.length];
  const b = spec.palette[(h >> 3) % spec.palette.length];
  const id = `g${h}`;
  const small = width < 70;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={a} />
            <Stop offset="1" stopColor={b === a ? spec.accent : b} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={`url(#${id})`} />
      </Svg>
      <View style={[styles.generated, { padding: small ? 6 : 12 }]}>
        <Icon name={category} size={small ? 14 : 18} color="rgba(22,20,18,0.55)" strokeWidth={1.8} />
        {!small && (
          <Text style={[styles.genTitle, { fontSize: Math.max(13, Math.min(22, width / 7)) }]} numberOfLines={4}>
            {title}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { flex: 1, overflow: 'hidden', backgroundColor: '#EEE9E2' },
  generated: { flex: 1, justifyContent: 'space-between' },
  genTitle: { fontFamily: fonts.displayItalic, color: 'rgba(22,20,18,0.82)', lineHeight: undefined },
});
