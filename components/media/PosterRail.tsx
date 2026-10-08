import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import Poster from '@/components/ui/Poster';
import PressableScale from '@/components/ui/PressableScale';
import { FadeIn } from '@/components/ui/Motion';
import { makeStyles } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import type { MediaKind } from '@/lib/types';

export interface RailItem {
  key: string;
  href: string;
  title: string;
  poster?: string;
  kind: MediaKind;
  caption?: string;
  progress?: number;
}

/** A sideways row of posters that runs past the screen edge. */
export default function PosterRail({ items }: { items: RailItem[] }) {
  const router = useRouter();
  const styles = useStyles();
  const { gutter, railPoster } = useLayout();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ paddingHorizontal: gutter, gap: 14, paddingBottom: 6 }}>
      {items.map((it, i) => (
        <FadeIn key={it.key} index={i} distance={10}>
          <PressableScale onPress={() => router.push(it.href as never)} style={{ width: railPoster, gap: 8 }} accessibilityLabel={it.title}>
            <Poster uri={it.poster} title={it.title} width={railPoster} kind={it.kind} progress={it.progress} />
            <View style={{ gap: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {it.title}
              </Text>
              {!!it.caption && (
                <Text style={styles.caption} numberOfLines={1}>
                  {it.caption}
                </Text>
              )}
            </View>
          </PressableScale>
        </FadeIn>
      ))}
    </ScrollView>
  );
}

const useStyles = makeStyles(({ palette, fonts }) => ({
  title: { ...fonts.semibold, fontSize: 13.5, color: palette.ink },
  caption: { ...fonts.body, fontSize: 12, color: palette.inkSoft },
}));
