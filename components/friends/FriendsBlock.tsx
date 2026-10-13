import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { StarBadge } from '@/components/ui/StarRating';
import { FadeIn } from '@/components/ui/Motion';
import { makeStyles } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { REVIEW, Shareable, findTitle, localKey, setRatingShared } from '@/lib/friends';
import { useDigest } from '@/lib/ribbons';
import type { MediaKind } from '@/lib/types';
import { Switch } from '@/spark';
import { useFriends } from '@/store/useFriends';
import Avatar from './Avatar';
import Reactions from './Reactions';

interface Props {
  kind: MediaKind;
  item: Shareable;
  /** Your own rating (1–10) and review, if you gave them: what the switch shares. */
  rating?: number;
  review?: string;
}

/**
 * What the group made of a title: each member's stars and words, the average, and one switch for whether
 * yours are part of it. Rating and reviewing is recommending: there is nothing else to fill in. Absent until you have a name.
 */
export default function FriendsBlock({ kind, item, rating, review }: Props) {
  const { t } = useTranslation();
  const styles = useStyles();
  const haptics = useHaptics();
  const me = useFriends((s) => s.me);
  const members = useFriends((s) => s.members);
  const titles = useFriends((s) => s.titles);
  const reviews = useFriends((s) => s.reviews);
  const shareRatings = useFriends((s) => s.shareRatings);
  const choice = useFriends((s) => s.shared[localKey(kind, item)]);
  const d = useDigest();
  const id = useMemo(() => findTitle(titles, kind, item), [titles, kind, item]);

  const takes = useMemo(() => {
    if (!me || !d || id == null) return [];
    const by = new Map<string, { user: string; rating?: number; words?: (typeof reviews)[number]; legacy?: string; at: number }>();
    const take = (user: string) => by.get(user) ?? by.set(user, { user, at: 0 }).get(user)!;
    for (const r of d.ratings.get(id) ?? []) Object.assign(take(r.user), { rating: r.rating, at: Math.max(take(r.user).at, r.at) });
    for (const p of reviews) if (p.title === id && p.episode === REVIEW && members[p.user]) Object.assign(take(p.user), { words: p, at: Math.max(take(p.user).at, p.at) });
    // Recommendations from versions before 1.11: their words still count as a take.
    for (const r of d.recos.get(id) ?? []) if (r.note && !take(r.user).words) Object.assign(take(r.user), { legacy: r.note, at: Math.max(take(r.user).at, r.at) });
    // Words first (that is what people read), then the latest.
    return [...by.values()].filter((x) => x.rating != null || x.words || x.legacy).sort((a, b) => Number(!!b.words || !!b.legacy) - Number(!!a.words || !!a.legacy) || b.at - a.at);
  }, [me, d, id, reviews, members]);

  if (!me || !d) return null;
  const rated = takes.filter((x) => x.rating != null);
  const average = rated.length ? rated.reduce((n, x) => n + x.rating!, 0) / rated.length : undefined;
  const visible = choice ?? shareRatings;
  const hasTake = rating != null || !!review?.trim();

  return (
    <FadeIn index={4} style={styles.panel}>
      <View style={styles.head}>
        <Text style={styles.label}>{t('friends.block')}</Text>
        {average != null && (
          <View style={styles.average}>
            <StarBadge value={average} />
            <Text style={styles.count}>{t('friends.ratings', { count: rated.length })}</Text>
          </View>
        )}
      </View>

      {takes.length === 0 && <Text style={styles.hint}>{t('friends.nothingYet')}</Text>}

      {takes.map((x) => {
        const name = x.user === me ? t('friends.you') : members[x.user]?.name;
        const words = x.words?.body ?? x.legacy;
        return (
          <View key={x.user} style={styles.take}>
            <Avatar name={members[x.user]?.name} size={30} />
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.takeHead}>
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
                {x.rating != null && <StarBadge value={x.rating} />}
              </View>
              {!!words && <Text style={styles.words}>{words}</Text>}
              {!!x.words && <Reactions title={id!} post={x.words} />}
            </View>
          </View>
        );
      })}

      {/* Yours, title by title: shared with the group or kept to yourself, whatever the general rule in Social. */}
      {hasTake && (
        <View style={styles.share}>
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={styles.shareLabel}>{t('friends.showRating')}</Text>
            <Text style={styles.hint}>{t(visible ? 'friends.ratingShown' : 'friends.ratingHidden')}</Text>
          </View>
          <Switch
            value={visible}
            onValueChange={(v) => {
              haptics.select();
              setRatingShared(kind, item, v);
            }}
          />
        </View>
      )}
    </FadeIn>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  panel: { marginTop: 14, padding: 16, gap: 14, borderRadius: radii.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { ...type.label },
  average: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  count: { ...fonts.body, fontSize: 12, color: palette.inkSoft },
  take: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  takeHead: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 30 },
  name: { ...fonts.semibold, fontSize: 14, color: palette.ink, flexShrink: 1 },
  words: { ...fonts.displayItalic, fontSize: 16, lineHeight: 21, color: palette.ink },
  hint: { ...type.small, fontSize: 12.5, lineHeight: 17 },
  share: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: palette.hairline },
  shareLabel: { ...fonts.medium, fontSize: 14, color: palette.ink },
}));
