import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import PressableScale from '@/components/ui/PressableScale';
import { makeStyles } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { react } from '@/lib/friends';
import { Post, useFriends } from '@/store/useFriends';
import { useUi } from '@/store/useUi';

export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢'];

/** One emoji each on a post: a light way to answer, without writing. The same one again takes it back. */
export default function Reactions({ title, post }: { title: number; post: Post }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const haptics = useHaptics();
  const me = useFriends((s) => s.me);
  if (!me) return null;
  const counts = new Map<string, number>();
  for (const e of Object.values(post.reactions)) counts.set(e, (counts.get(e) ?? 0) + 1);
  return (
    <View style={styles.row}>
      {REACTIONS.map((e) => {
        const on = post.reactions[me] === e;
        const n = counts.get(e) ?? 0;
        return (
          <PressableScale
            key={e}
            depth={0.85}
            hitSlop={4}
            accessibilityState={{ selected: on }}
            onPress={() => {
              haptics.select();
              react(title, post, e).catch(() => useUi.getState().showToast(t('friends.offline')));
            }}
            style={[styles.reaction, on && styles.reactionOn, !n && { opacity: 0.45 }]}
          >
            <Text style={styles.emoji}>{e}</Text>
            {n > 0 && <Text style={styles.count}>{n}</Text>}
          </PressableScale>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts }) => ({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  reaction: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 26, paddingHorizontal: 7, borderRadius: 13, backgroundColor: palette.field, borderWidth: 1, borderColor: 'transparent' },
  reactionOn: { backgroundColor: palette.primaryTint, borderColor: palette.primaryRing },
  emoji: { fontSize: 13 },
  count: { ...fonts.semibold, fontSize: 11.5, color: palette.inkSoft },
}));
