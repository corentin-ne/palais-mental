import { memo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import Icon from './Icon';
import { makeStyles, useTheme } from '@/constants/theme';
import type { MediaKind } from '@/lib/types';

const KIND_ICON = { show: 'series', movie: 'movies', book: 'journal', game: 'play' } as const;
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7) >>> 0;

interface Props {
  uri?: string;
  title: string;
  width: number;
  kind?: MediaKind;
  radius?: number;
  /** 0–1: a slim bar along the bottom edge (show progress). */
  progress?: number;
  dim?: boolean;
  elevated?: boolean;
}

/** 2:3 artwork with a soft fade-in; titles without art get a generated cover in the app's blues. */
function Poster({ uri, title, width, kind = 'show', radius, progress, dim, elevated = true }: Props) {
  const { shadow, radii, palette } = useTheme();
  const styles = useStyles();
  const [failed, setFailed] = useState(false);
  const r = radius ?? (width > 120 ? radii.md : radii.sm);
  const height = Math.round(width * 1.5);
  const tint = palette.posterTints[hash(title) % palette.posterTints.length];
  return (
    <View style={[{ width, height, borderRadius: r }, elevated && shadow.cover]}>
      <View style={[styles.clip, { borderRadius: r }]}>
        {uri && !failed ? (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={260}
            recyclingKey={uri}
            // Decoded posters stay in memory: walls and rails scroll back without a reload.
            cachePolicy="memory-disk"
            onError={() => setFailed(true)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <LinearGradient colors={tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.generated]}>
            <Icon name={KIND_ICON[kind]} size={width < 80 ? 14 : 18} color={palette.inkFaint} />
            {width >= 80 && (
              <Text style={[styles.genTitle, { fontSize: Math.max(13, Math.min(22, width / 7)) }]} numberOfLines={4}>
                {title}
              </Text>
            )}
          </LinearGradient>
        )}
        {dim && <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.dimVeil }]} />}
        {progress != null && progress > 0 && (
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: progress >= 1 ? palette.success : palette.primary }]} />
          </View>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ fonts, palette }) => ({
  clip: { flex: 1, overflow: 'hidden', backgroundColor: palette.placeholder },
  generated: { padding: 10, justifyContent: 'space-between' },
  genTitle: { fontFamily: fonts.displayItalic, color: palette.posterInk },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: 'rgba(10,37,64,0.25)' },
  fill: { height: 4 },
}));

/** Posters re-render only when what they show changes. */
export default memo(Poster);
