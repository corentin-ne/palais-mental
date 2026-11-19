import { useMemo, useRef, useState } from 'react';
import { Animated, Easing, Text, TextInput, View } from 'react-native';
import { Href, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import Avatar from './Avatar';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Poster from '@/components/ui/Poster';
import PressableScale from '@/components/ui/PressableScale';
import Sheet from '@/components/ui/Sheet';
import { FadeIn } from '@/components/ui/Motion';
import { makeStyles, noOutline, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { relativeDay } from '@/lib/format';
import { Shareable, hrefOf, markSentSeen, sendTitle } from '@/lib/friends';
import type { MediaKind } from '@/lib/types';
import { useFriends } from '@/store/useFriends';
import { useLibrary } from '@/store/useLibrary';
import { useUi } from '@/store/useUi';

/** "Send to…" under the group's take on a title: pick a member, add a few words, off it goes. */
export function SendButton({ kind, item }: { kind: MediaKind; item: Shareable }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const me = useFriends((s) => s.me);
  const others = useFriends((s) => Object.keys(s.members).filter((id) => id !== s.me).length);
  if (!me || !others) return null;
  return (
    <>
      <Button label={t('send.button')} icon="send" variant="secondary" compact onPress={() => setOpen(true)} style={{ alignSelf: 'flex-start' }} />
      <SendSheet kind={kind} item={item} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

function SendSheet({ kind, item, visible, onClose }: { kind: MediaKind; item: Shareable; visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const { palette } = useTheme();
  const haptics = useHaptics();
  const me = useFriends((s) => s.me);
  const members = useFriends((s) => s.members);
  const people = useMemo(() => Object.values(members).filter((m) => m.id !== me).sort((a, b) => a.name.localeCompare(b.name)), [members, me]);
  const [to, setTo] = useState<string>();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const fly = useRef(new Animated.Value(0)).current;

  const send = async () => {
    if (!to) return;
    setBusy(true);
    try {
      await sendTitle(kind, item, to, note);
      haptics.success();
      // The plane takes off, then the sheet closes.
      fly.setValue(0);
      Animated.timing(fly, { toValue: 1, duration: 520, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
        onClose();
        fly.setValue(0);
        setTo(undefined);
        setNote('');
      });
      useUi.getState().showToast(t('send.sent', { title: item.title, name: members[to]?.name ?? '' }));
    } catch {
      haptics.warn();
      useUi.getState().showToast(t('send.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('send.title')}
      subtitle={item.title}
      footer={
        <View>
          <Animated.View
            pointerEvents="none"
            style={[styles.plane, { opacity: fly.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 1, 1, 0] }), transform: [{ translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [0, 260] }) }, { translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [0, -140] }) }, { rotate: '-20deg' }] }]}
          >
            <Icon name="send" size={26} color={palette.primaryText} strokeWidth={2.2} />
          </Animated.View>
          <Button label={to ? t('send.to', { name: members[to]?.name ?? '' }) : t('send.pick')} icon="send" onPress={send} disabled={!to} loading={busy} />
        </View>
      }
    >
      <View style={styles.people}>
        {people.map((m) => {
          const on = m.id === to;
          return (
            <PressableScale
              key={m.id}
              depth={0.9}
              onPress={() => {
                haptics.select();
                setTo(on ? undefined : m.id);
              }}
              style={[styles.person, on && { backgroundColor: palette.primaryTint, borderColor: palette.primaryRing }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={m.name}
            >
              <Avatar name={m.name} size={40} />
              <Text style={styles.personName} numberOfLines={1}>
                {m.name}
              </Text>
            </PressableScale>
          );
        })}
      </View>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder={t('send.notePlaceholder')}
        placeholderTextColor={palette.inkFaint}
        maxLength={280}
        multiline
        style={[styles.note, noOutline]}
        accessibilityLabel={t('send.note')}
      />
      <Text style={styles.privacy}>{t('send.privacy')}</Text>
    </Sheet>
  );
}

/** What members sent you, newest first; opening one or waving it off takes it out. */
export function SentToMe({ compact }: { compact?: boolean }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const router = useRouter();
  const { palette } = useTheme();
  const sent = useFriends((s) => s.sentToMe);
  const seen = useFriends((s) => s.sentSeen);
  const members = useFriends((s) => s.members);
  const titles = useFriends((s) => s.titles);
  const tmdbKey = useLibrary((s) => s.settings.tmdbKey) || undefined;
  const list = useMemo(() => (sent ?? []).filter((s) => !seen[`${s.from}:${s.title}`] && titles[s.title] && members[s.from]), [sent, seen, titles, members]);
  if (!list.length) return null;
  return (
    <View style={{ marginTop: compact ? 24 : 30, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="send" size={18} color={palette.primaryText} strokeWidth={2.2} />
        <Text style={styles.heading}>{t('send.forYou')}</Text>
      </View>
      {list.slice(0, compact ? 3 : 10).map((s, i) => {
        const title = titles[s.title];
        return (
          <FadeIn key={`${s.from}:${s.title}`} index={i} distance={8}>
            <View style={styles.card}>
              <PressableScale
                depth={0.98}
                style={styles.cardOpen}
                onPress={() => {
                  markSentSeen(s);
                  router.push(hrefOf(title, tmdbKey) as Href);
                }}
                accessibilityLabel={`${title.title}, ${t('send.from', { name: members[s.from].name })}`}
              >
                <Poster uri={title.poster} title={title.title} width={52} kind={title.kind} elevated={false} radius={7} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {title.title}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Avatar name={members[s.from].name} size={18} />
                    <Text style={styles.from} numberOfLines={1}>
                      {t('send.from', { name: members[s.from].name })} · {relativeDay(s.at)}
                    </Text>
                  </View>
                  {!!s.note && (
                    <Text style={styles.cardNote} numberOfLines={3}>
                      “{s.note}”
                    </Text>
                  )}
                </View>
              </PressableScale>
              <PressableScale onPress={() => markSentSeen(s)} hitSlop={10} style={styles.dismiss} accessibilityLabel={t('send.dismiss')}>
                <Icon name="close" size={16} color={palette.inkFaint} strokeWidth={2.2} />
              </PressableScale>
            </View>
          </FadeIn>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  person: { width: 84, alignItems: 'center', gap: 6, paddingVertical: 10, borderRadius: radii.md, borderWidth: 1, borderColor: 'transparent' },
  personName: { ...fonts.medium, fontSize: 12.5, color: palette.ink, maxWidth: 76 },
  note: { minHeight: 70, padding: 12, borderRadius: radii.md, backgroundColor: palette.field, ...fonts.body, fontSize: 15, color: palette.ink, textAlignVertical: 'top' },
  privacy: { ...type.small, fontSize: 11.5 },
  plane: { position: 'absolute', left: 24, top: 10, zIndex: 2 },
  heading: { ...type.title },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: radii.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  cardOpen: { flex: 1, flexDirection: 'row', gap: 12 },
  cardTitle: { ...fonts.semibold, fontSize: 15.5, color: palette.ink },
  from: { ...fonts.medium, fontSize: 12.5, color: palette.inkSoft, flexShrink: 1 },
  cardNote: { ...fonts.displayItalic, fontSize: 14.5, lineHeight: 19, color: palette.ink },
  dismiss: { padding: 4 },
}));
