import { ScrollView, Text, View } from 'react-native';
import { Href, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import Poster from '@/components/ui/Poster';
import PressableScale from '@/components/ui/PressableScale';
import { FadeIn } from '@/components/ui/Motion';
import { makeStyles } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { hrefOf } from '@/lib/friends';
import { Suggestion, bandOf } from '@/lib/ribbons';
import { useFriends } from '@/store/useFriends';
import { useLibrary } from '@/store/useLibrary';

/** What friends loved, each under its red band when it earned one, with who rated it. */
export default function FriendsRail({ items }: { items: Suggestion[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useStyles();
  const { gutter, railPoster } = useLayout();
  const members = useFriends((s) => s.members);
  const tmdbKey = useLibrary((s) => s.settings.tmdbKey) || undefined;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ paddingHorizontal: gutter, gap: 14, paddingBottom: 6 }}>
      {items.map(({ title, ratings, ribbon }, i) => (
        <FadeIn key={title.id} index={i} distance={10}>
          <PressableScale onPress={() => router.push(hrefOf(title, tmdbKey) as Href)} style={{ width: railPoster, gap: 8 }} accessibilityLabel={title.title}>
            <Poster uri={title.poster} title={title.title} width={railPoster} kind={title.kind} ribbon={ribbon && bandOf(t, ribbon, members)} />
            <View style={{ gap: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {title.title}
              </Text>
              <Text style={styles.caption} numberOfLines={1}>
                {ratings.map((r) => `★ ${(r.rating / 2).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${members[r.user]?.name ?? ''}`).join(' · ')}
              </Text>
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
