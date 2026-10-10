import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import PressableScale from '@/components/ui/PressableScale';
import { StarBadge } from '@/components/ui/StarRating';
import { makeStyles, noOutline, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { Shareable, addPost, react, removePost } from '@/lib/friends';
import { relativeDay } from '@/lib/format';
import type { EpisodeNote } from '@/lib/types';
import { Post, useFriends } from '@/store/useFriends';
import { useUi } from '@/store/useUi';

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢'];

interface Props {
  show: Shareable;
  /** The show as friends share it, once anything was said about it. */
  titleId?: number;
  episodeId: number;
  watched: boolean;
  posts: Post[];
  /** Your private note on the episode: one tap brings it into the thread. */
  note?: EpisodeNote;
}

/**
 * What friends said about an episode. Closed until you have ticked it: before that, only how many
 * messages are waiting, so nothing is spoiled.
 */
export default function EpisodeTalk({ show, titleId, episodeId, watched, posts, note }: Props) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const haptics = useHaptics();
  const me = useFriends((s) => s.me);
  const members = useFriends((s) => s.members);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  if (!me) return null;

  if (!watched) {
    if (!posts.length) return null;
    return (
      <View style={[styles.panel, styles.locked]}>
        <Icon name="eye" size={16} color={palette.inkFaint} />
        <Text style={styles.lockedText}>{t('friends.talkLocked', { count: posts.length })}</Text>
      </View>
    );
  }

  const offline = () => useUi.getState().showToast(t('friends.offline'));
  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    try {
      await addPost(show, episodeId, body, note?.text && body === note.text.trim() ? note.rating : undefined);
      haptics.success();
      setDraft('');
    } catch {
      offline();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.label}>{t('friends.talk')}</Text>
      {posts.map((p) => {
        const counts = new Map<string, number>();
        for (const e of Object.values(p.reactions)) counts.set(e, (counts.get(e) ?? 0) + 1);
        return (
          <View key={p.id} style={styles.post}>
            <Text style={styles.emoji}>{members[p.user]?.emoji ?? '🙂'}</Text>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.postHead}>
                <Text style={styles.name}>{p.user === me ? t('friends.you') : (members[p.user]?.name ?? '…')}</Text>
                {p.rating != null && <StarBadge value={p.rating} />}
                <Text style={styles.when}>{relativeDay(p.at)}</Text>
                {p.user === me && titleId != null && (
                  <PressableScale hitSlop={8} onPress={() => removePost(titleId, p.id).catch(offline)} accessibilityLabel={t('common.remove')} style={{ marginLeft: 'auto' }}>
                    <Icon name="trash" size={14} color={palette.inkFaint} />
                  </PressableScale>
                )}
              </View>
              <Text style={styles.body}>{p.body}</Text>
              <View style={styles.reactions}>
                {REACTIONS.map((e) => {
                  const on = p.reactions[me] === e;
                  const n = counts.get(e) ?? 0;
                  return (
                    <PressableScale
                      key={e}
                      depth={0.85}
                      hitSlop={4}
                      accessibilityState={{ selected: on }}
                      onPress={() => {
                        if (titleId == null) return;
                        haptics.select();
                        react(titleId, p, e).catch(offline);
                      }}
                      style={[styles.reaction, on && styles.reactionOn, !n && { opacity: 0.45 }]}
                    >
                      <Text style={styles.reactionEmoji}>{e}</Text>
                      {n > 0 && <Text style={styles.reactionCount}>{n}</Text>}
                    </PressableScale>
                  );
                })}
              </View>
            </View>
          </View>
        );
      })}
      {!posts.length && <Text style={styles.hint}>{t('friends.talkEmpty')}</Text>}
      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t('friends.talkPlaceholder')}
          placeholderTextColor={palette.inkFaint}
          maxLength={1000}
          multiline
          style={[styles.input, noOutline]}
        />
        <Button label={t('friends.send')} icon="check" iconOnly compact onPress={send} loading={busy} disabled={!draft.trim()} />
      </View>
      {!!note?.text && !draft && (
        <PressableScale onPress={() => setDraft(note.text!)} style={{ alignSelf: 'flex-start' }}>
          <Text style={styles.link}>{t('friends.useNote')}</Text>
        </PressableScale>
      )}
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts, type }) => ({
  panel: { gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: palette.hairline },
  locked: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lockedText: { ...type.small, flex: 1, fontSize: 12.5 },
  label: { ...type.label },
  post: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  emoji: { fontSize: 18, marginTop: 1 },
  name: { ...fonts.semibold, fontSize: 13, color: palette.ink },
  when: { ...fonts.body, fontSize: 11.5, color: palette.inkFaint },
  body: { ...type.body, fontSize: 14.5, lineHeight: 20, color: palette.ink },
  reactions: { flexDirection: 'row', gap: 4 },
  reaction: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 26, paddingHorizontal: 7, borderRadius: 13, backgroundColor: palette.field, borderWidth: 1, borderColor: 'transparent' },
  reactionOn: { backgroundColor: palette.primaryTint, borderColor: palette.primaryRing },
  reactionEmoji: { fontSize: 13 },
  reactionCount: { ...fonts.semibold, fontSize: 11.5, color: palette.inkSoft },
  hint: { ...type.small, fontSize: 12.5 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, minHeight: 40, maxHeight: 120, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: palette.field, ...fonts.body, fontSize: 14.5, color: palette.ink },
  link: { ...fonts.semibold, fontSize: 13, color: palette.primaryText },
}));
