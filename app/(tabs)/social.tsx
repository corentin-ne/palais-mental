import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Href, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import Avatar from '@/components/friends/Avatar';
import FriendsRail from '@/components/friends/FriendsRail';
import NameField from '@/components/friends/NameField';
import Reactions from '@/components/friends/Reactions';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Poster from '@/components/ui/Poster';
import PressableScale from '@/components/ui/PressableScale';
import Screen, { Section } from '@/components/ui/Screen';
import { Group } from '@/components/ui/SettingsList';
import { StarBadge } from '@/components/ui/StarRating';
import { FadeIn } from '@/components/ui/Motion';
import { makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { useLayout } from '@/hooks/useLayout';
import { FeedItem, buildFeed } from '@/lib/feed';
import { relativeDay } from '@/lib/format';
import { leaveFriends, pushRatings, setShareRatings, syncFriends } from '@/lib/friends';
import { useDigest, useLocalHrefs, useSuggestions } from '@/lib/ribbons';
import { Switch } from '@/spark';
import { SharedTitle, useFriends } from '@/store/useFriends';
import { useLibrary } from '@/store/useLibrary';
import { useUi } from '@/store/useUi';

const PAGE = 25;

/**
 * Social, on one page: who is in the group, what they would hand you, then everything they shared as
 * it came — reviews, ratings, and what they said about episodes. Sharing is rating and writing a few
 * words: there is nothing else to fill in. Read from the last sync, so it opens the same offline.
 */
export default function SocialScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const me = useFriends((s) => s.me);
  const members = useFriends((s) => s.members);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    syncFriends(true);
  }, []);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncFriends(true);
    setRefreshing(false);
  }, []);

  // No name yet: choosing one comes first, everything else appears once you are in.
  if (!me)
    return (
      <Screen title={t('friends.title')}>
        <FadeIn style={styles.intro}>
          <Text style={styles.introTitle}>{t('friends.introTitle')}</Text>
          <Text style={styles.introBody}>{t('friends.introBody')}</Text>
        </FadeIn>
        <Group index={1} title={t('friends.name')}>
          <View style={styles.block}>
            <NameField />
          </View>
        </Group>
        <Text style={styles.footnote}>{t('friends.privacy')}</Text>
      </Screen>
    );

  return (
    <Screen title={t('friends.title')} subtitle={t('friends.members', { count: Object.keys(members).length })} refreshing={refreshing} onRefresh={onRefresh}>
      <People me={me} />
      <ShareNudge />
      <ForYou />
      <Feed me={me} />
      <You />
      <Text style={styles.footnote}>{t('friends.privacy')}</Text>
    </Screen>
  );
}

/** The group at a glance: a face per person, and how close their taste is to yours. */
function People({ me }: { me: string }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const { gutter } = useLayout();
  const members = useFriends((s) => s.members);
  const d = useDigest();
  const list = Object.values(members).sort((a, b) => Number(b.id === me) - Number(a.id === me) || (d?.affinity.get(b.id) ?? -1) - (d?.affinity.get(a.id) ?? -1) || a.joinedAt - b.joinedAt);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter, marginTop: 14 }} contentContainerStyle={{ paddingHorizontal: gutter, gap: 14 }}>
      {list.map((m, i) => {
        const affinity = d?.affinity.get(m.id);
        return (
          <FadeIn key={m.id} index={i} distance={6} style={styles.person}>
            <Avatar name={m.name} size={52} />
            <Text style={styles.personName} numberOfLines={1}>
              {m.id === me ? t('friends.you') : m.name.trim().split(/\s+/)[0]}
            </Text>
            {affinity != null && <Text style={styles.match}>{t('friends.match', { percent: Math.round(affinity * 100) })}</Text>}
          </FadeIn>
        );
      })}
    </ScrollView>
  );
}

/** Nothing of yours is shared yet, or your words stay behind: one tap, said plainly, at the top. */
function ShareNudge() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const haptics = useHaptics();
  const shareRatings = useFriends((s) => s.shareRatings);
  const shareReviews = useFriends((s) => s.shareReviews);
  if (shareRatings && shareReviews) return null;
  const words = shareRatings && !shareReviews;
  return (
    <FadeIn index={1} style={styles.nudge}>
      <Icon name="heart" size={20} color={palette.primaryText} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.nudgeTitle}>{t(words ? 'friends.nudgeWordsTitle' : 'friends.nudgeTitle')}</Text>
        <Text style={styles.hint}>{t(words ? 'friends.nudgeWords' : 'friends.nudge')}</Text>
      </View>
      <Button
        label={t('friends.shareCta')}
        compact
        onPress={() => {
          haptics.success();
          if (words) {
            useFriends.getState().set({ shareReviews: true });
            pushRatings();
          } else setShareRatings(true);
        }}
      />
    </FadeIn>
  );
}

/** What the others loved that you don't have yet. */
function ForYou() {
  const { t } = useTranslation();
  const suggestions = useSuggestions();
  if (!suggestions.length) return null;
  return (
    <Section title={t('friends.suggested')} count={suggestions.length}>
      <FriendsRail items={suggestions} />
    </Section>
  );
}

/** Everything shared, latest first. */
function Feed({ me }: { me: string }) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const members = useFriends((s) => s.members);
  const titles = useFriends((s) => s.titles);
  const ratings = useFriends((s) => s.ratings);
  const reviews = useFriends((s) => s.reviews);
  const talk = useFriends((s) => s.talk);
  const [shown, setShown] = useState(PAGE);
  const feed = useMemo(() => buildFeed({ members, titles, ratings, reviews, talk }), [members, titles, ratings, reviews, talk]);

  return (
    <Section title={t('friends.feed')}>
      {feed.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="sparkle" size={22} color={palette.primaryText} />
          <Text style={styles.emptyText}>{t('friends.feedEmpty')}</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {feed.slice(0, shown).map((item, i) => (
            <FadeIn key={item.key} index={Math.min(i, 8)} distance={8}>
              <FeedCard item={item} me={me} />
            </FadeIn>
          ))}
          {feed.length > shown && <Button label={t('friends.more')} variant="ghost" compact onPress={() => setShown((n) => n + PAGE)} style={{ alignSelf: 'center' }} />}
        </View>
      )}
    </Section>
  );
}

function FeedCard({ item, me }: { item: FeedItem; me: string }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const router = useRouter();
  const members = useFriends((s) => s.members);
  const hrefs = useLocalHrefs();
  const name = item.user === me ? t('friends.you') : (members[item.user]?.name ?? '…');
  const open = (title: SharedTitle) => router.push(hrefs(title).href as Href);

  const head = (action: string, extra?: ReactNode) => (
    <View style={styles.cardHead}>
      <Avatar name={members[item.user]?.name} size={26} />
      <Text style={styles.cardWho} numberOfLines={1}>
        <Text style={styles.cardName}>{name}</Text> {action}
      </Text>
      {extra}
      <Text style={styles.when}>{relativeDay(item.at)}</Text>
    </View>
  );

  if (item.type === 'rated') {
    return (
      <View style={styles.card}>
        {head(t('friends.ratedN', { count: item.items.length }))}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {item.items.slice(0, 12).map(({ title, rating }) => (
            <PressableScale key={title.id} depth={0.95} onPress={() => open(title)} style={{ width: 64, gap: 5 }} accessibilityLabel={title.title}>
              <Poster uri={title.poster} title={title.title} width={64} kind={title.kind} elevated={false} radius={6} />
              <StarBadge value={rating} />
            </PressableScale>
          ))}
        </ScrollView>
      </View>
    );
  }

  const title = item.title;
  const episode = item.type === 'talk' ? <EpisodeLabel title={title} episode={item.post.episode} /> : undefined;
  return (
    <PressableScale depth={0.98} onPress={() => open(title)} style={styles.card} accessibilityLabel={title.title}>
      {head(t(item.type === 'talk' ? 'friends.onEpisode' : 'friends.onTitle'), 'rating' in item && item.rating != null ? <StarBadge value={item.rating} /> : undefined)}
      <View style={styles.cardBody}>
        <Poster uri={title.poster} title={title.title} width={52} kind={title.kind} elevated={false} radius={6} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {title.title}
            {episode}
          </Text>
          {item.type === 'talk' ? <Spoiler title={title} post={item.post} mine={item.user === me} /> : <Text style={styles.words}>{item.post.body}</Text>}
        </View>
      </View>
      <Reactions title={title.id} post={item.post} />
    </PressableScale>
  );
}

/** "· S2E5", when the show is in your library and knows the episode. */
function EpisodeLabel({ title, episode }: { title: SharedTitle; episode: number }) {
  const styles = useStyles();
  const ep = useLibrary((s) => s.shows[title.route]?.episodes.find((e) => e.id === episode));
  if (!ep) return null;
  return <Text style={styles.cardEpisode}>{`  S${ep.season}E${ep.number}`}</Text>;
}

/** A message on an episode you haven't ticked stays veiled until you choose to read it. */
function Spoiler({ title, post, mine }: { title: SharedTitle; post: { episode: number; body: string }; mine: boolean }) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const seen = useLibrary((s) => !!s.shows[title.route]?.watched[post.episode]);
  const [open, setOpen] = useState(false);
  if (seen || mine || open) return <Text style={styles.message}>{post.body}</Text>;
  return (
    <PressableScale depth={0.97} onPress={() => setOpen(true)} style={styles.veil} accessibilityLabel={t('friends.spoilerReveal')}>
      <Icon name="eye" size={15} color={palette.inkSoft} />
      <Text style={styles.veilText}>{t('friends.spoiler')}</Text>
    </PressableScale>
  );
}

/** Your side of it: what you share, your name, and the way out. */
function You() {
  const { t } = useTranslation();
  const styles = useStyles();
  const haptics = useHaptics();
  const shareRatings = useFriends((s) => s.shareRatings);
  const [leaving, setLeaving] = useState(false);
  const [sure, setSure] = useState(false);
  const leave = async () => {
    if (!sure) return setSure(true);
    setLeaving(true);
    try {
      await leaveFriends();
      useUi.getState().showToast(t('friends.left'));
    } catch {
      useUi.getState().showToast(t('friends.offline'));
      setLeaving(false);
    }
  };
  return (
    <>
      <Group index={2} title={t('friends.sharing')}>
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={styles.rowLabel}>{t('friends.shareRatings')}</Text>
            <Text style={styles.hint}>{t(shareRatings ? 'friends.shareRatingsOn' : 'friends.shareRatingsOff')}</Text>
          </View>
          <Switch
            value={shareRatings}
            onValueChange={(v) => {
              haptics.select();
              setShareRatings(v);
            }}
          />
        </View>
        <View style={[styles.block, styles.line]}>
          <Text style={styles.rowLabel}>{t('friends.name')}</Text>
          <NameField />
        </View>
      </Group>
      <FadeIn index={3} style={{ marginTop: 18, gap: 8 }}>
        <Button label={t(sure ? 'friends.leaveSure' : 'friends.leave')} icon="trash" variant="danger" compact onPress={leave} loading={leaving} style={{ alignSelf: 'flex-start' }} />
        <Text style={styles.hint}>{t('friends.leaveHint')}</Text>
      </FadeIn>
    </>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  intro: { marginTop: 18, gap: 6 },
  introTitle: { ...type.title },
  introBody: { ...type.body, color: palette.inkSoft, lineHeight: 22 },
  block: { padding: 14, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 },
  line: { borderTopWidth: 1, borderTopColor: palette.hairline },
  rowLabel: { ...fonts.medium, fontSize: 15, color: palette.ink },
  hint: { ...type.small, fontSize: 12.5, lineHeight: 17 },
  footnote: { ...type.small, fontSize: 12, marginTop: 14, marginHorizontal: 4, lineHeight: 17 },
  person: { width: 64, alignItems: 'center', gap: 5 },
  personName: { ...fonts.medium, fontSize: 12.5, color: palette.ink, maxWidth: 64 },
  match: { ...fonts.semibold, fontSize: 11, color: palette.primaryText, marginTop: -3 },
  nudge: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, padding: 14, borderRadius: radii.lg, backgroundColor: palette.primaryTint, borderWidth: 1, borderColor: palette.primaryRing },
  nudgeTitle: { ...fonts.semibold, fontSize: 14.5, color: palette.ink },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radii.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  emptyText: { ...type.small, flex: 1 },
  card: { gap: 10, padding: 12, borderRadius: radii.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardWho: { ...fonts.body, fontSize: 13, color: palette.inkSoft, flexShrink: 1 },
  cardName: { ...fonts.semibold, color: palette.ink },
  when: { ...fonts.body, fontSize: 12, color: palette.inkFaint, marginLeft: 'auto' },
  cardBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardTitle: { ...fonts.semibold, fontSize: 15, color: palette.ink, letterSpacing: -0.15 },
  cardEpisode: { ...fonts.medium, fontSize: 13, color: palette.primaryText },
  words: { ...fonts.displayItalic, fontSize: 16, lineHeight: 21, color: palette.ink },
  message: { ...type.body, fontSize: 14.5, lineHeight: 20, color: palette.ink },
  veil: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: palette.field, alignSelf: 'flex-start' },
  veilText: { ...fonts.medium, fontSize: 13, color: palette.inkSoft },
}));
