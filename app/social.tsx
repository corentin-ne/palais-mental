import { ReactNode, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import PressableScale from '@/components/ui/PressableScale';
import { FadeIn } from '@/components/ui/Motion';
import { makeStyles, noOutline, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { useLayout } from '@/hooks/useLayout';
import { JoinError, joinFriends, leaveFriends, setShareRatings, syncFriends, updateProfile } from '@/lib/friends';
import { quorumFor, useDigest } from '@/lib/ribbons';
import { Aurora, Switch } from '@/spark';
import { useFriends } from '@/store/useFriends';
import { useLibrary } from '@/store/useLibrary';
import { useUi } from '@/store/useUi';

const EMOJIS = ['🙂', '😎', '🤓', '🥸', '🦊', '🐼', '🐸', '🐙', '🦉', '🐺', '🦄', '🐝', '🍿', '🎬', '📚', '🎮', '👾', '🚀', '🌙', '🔥'];

/** Your friends: join them with the access code, see who is there, choose what you share, or leave. */
export default function SocialScreen() {
  const { t } = useTranslation();
  const { palette, type } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { gutter, content } = useLayout();
  const me = useFriends((s) => s.me);
  useEffect(() => {
    syncFriends(true);
  }, []);
  return (
    <View style={styles.root}>
      <Aurora />
      <View style={[styles.header, { paddingTop: insets.top + 8, paddingHorizontal: gutter, width: content }]}>
        <PressableScale onPress={() => router.back()} style={styles.back} accessibilityLabel={t('common.back')}>
          <Icon name="back" size={20} color={palette.ink} strokeWidth={2.2} />
        </PressableScale>
        <Text style={type.hero}>{t('friends.title')}</Text>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 48, paddingHorizontal: gutter, width: content, alignSelf: 'center' }}>
        {me ? <Joined me={me} /> : <Join />}
        <Text style={styles.footnote}>{t('friends.privacy')}</Text>
      </ScrollView>
    </View>
  );
}

function Group({ title, index, children }: { title: string; index: number; children: ReactNode }) {
  const styles = useStyles();
  return (
    <FadeIn index={index} style={{ marginTop: 26, gap: 8 }}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.group}>{children}</View>
    </FadeIn>
  );
}

/** A first name and a face: all there is to an account here. */
function Identity({ name, emoji, onName, onEmoji }: { name: string; emoji: string; onName: (v: string) => void; onEmoji: (v: string) => void }) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const haptics = useHaptics();
  return (
    <>
      <TextInput value={name} onChangeText={onName} placeholder={t('friends.namePlaceholder')} placeholderTextColor={palette.inkFaint} maxLength={24} autoCorrect={false} style={[styles.input, noOutline]} />
      <View style={styles.emojis} accessibilityRole="radiogroup">
        {EMOJIS.map((e) => (
          <PressableScale
            key={e}
            depth={0.85}
            accessibilityRole="radio"
            accessibilityState={{ selected: e === emoji }}
            onPress={() => {
              haptics.select();
              onEmoji(e);
            }}
            style={[styles.emoji, e === emoji && styles.emojiOn]}
          >
            <Text style={styles.emojiText}>{e}</Text>
          </PressableScale>
        ))}
      </View>
    </>
  );
}

function Join() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const haptics = useHaptics();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<JoinError>();

  const join = async () => {
    setBusy(true);
    setError(undefined);
    const failed = await joinFriends(code, name.trim(), emoji);
    setBusy(false);
    if (failed) return setError(failed);
    haptics.success();
    useUi.getState().showToast(t('friends.joined'));
  };

  return (
    <>
      <FadeIn style={styles.intro}>
        <Text style={styles.introTitle}>{t('friends.introTitle')}</Text>
        <Text style={styles.introBody}>{t('friends.introBody')}</Text>
      </FadeIn>
      <Group index={1} title={t('friends.you')}>
        <View style={styles.block}>
          <Identity name={name} emoji={emoji} onName={setName} onEmoji={setEmoji} />
        </View>
      </Group>
      <Group index={2} title={t('friends.code')}>
        <View style={styles.block}>
          <TextInput
            value={code}
            onChangeText={(v) => {
              setCode(v);
              setError(undefined);
            }}
            placeholder={t('friends.codePlaceholder')}
            placeholderTextColor={palette.inkFaint}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, !!error && error !== 'offline' && { borderColor: palette.danger }, noOutline]}
            onSubmitEditing={join}
          />
          <Text style={styles.hint}>{t('friends.codeHint')}</Text>
          {!!error && <Text style={[styles.hint, { color: palette.danger }]}>{t(`friends.error.${error}`)}</Text>}
          <Button label={t('friends.join')} icon="check" onPress={join} loading={busy} disabled={!name.trim() || !code.trim()} style={{ alignSelf: 'stretch' }} />
        </View>
      </Group>
    </>
  );
}

function Joined({ me }: { me: string }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const haptics = useHaptics();
  const members = useFriends((s) => s.members);
  const ratings = useFriends((s) => s.ratings);
  const recos = useFriends((s) => s.recos);
  const shareRatings = useFriends((s) => s.shareRatings);
  const d = useDigest();
  const self = members[me];
  const [name, setName] = useState(self?.name ?? '');
  const [emoji, setEmoji] = useState(self?.emoji ?? EMOJIS[0]);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [sure, setSure] = useState(false);
  useEffect(() => {
    if (self) {
      setName(self.name);
      setEmoji(self.emoji);
    }
  }, [self]);

  // How many ratings the library holds: what turning sharing on would send.
  const shows = useLibrary((s) => s.shows);
  const movies = useLibrary((s) => s.movies);
  const books = useLibrary((s) => s.books);
  const games = useLibrary((s) => s.games);
  const rated = useMemo(() => [shows, movies, books, games].reduce((n, set) => n + Object.values(set).filter((i) => i.rating != null).length, 0), [shows, movies, books, games]);

  const list = Object.values(members).sort((a, b) => Number(b.id === me) - Number(a.id === me) || a.joinedAt - b.joinedAt);
  const offline = () => useUi.getState().showToast(t('friends.offline'));
  const save = async () => {
    setSaving(true);
    try {
      await updateProfile(name.trim(), emoji);
      haptics.success();
    } catch {
      offline();
    } finally {
      setSaving(false);
    }
  };
  const leave = async () => {
    if (!sure) return setSure(true);
    setLeaving(true);
    try {
      await leaveFriends();
      useUi.getState().showToast(t('friends.left'));
    } catch {
      offline();
      setLeaving(false);
    }
  };

  return (
    <>
      <Group index={0} title={t('friends.members', { count: list.length })}>
        {list.map((m, i) => {
          const affinity = d?.affinity.get(m.id);
          const counts = [
            t('friends.nRatings', { count: ratings.filter((r) => r.user === m.id).length }),
            t('friends.nRecos', { count: recos.filter((r) => r.user === m.id).length }),
          ].join(' · ');
          return (
            <View key={m.id} style={[styles.row, i < list.length - 1 && styles.line]}>
              <Text style={styles.face}>{m.emoji}</Text>
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={styles.rowLabel}>{m.id === me ? t('friends.nameYou', { name: m.name }) : m.name}</Text>
                <Text style={styles.hint}>{counts}</Text>
              </View>
              {affinity != null && (
                <View style={styles.affinity}>
                  <Text style={styles.affinityText}>{t('friends.affinity', { percent: Math.round(affinity * 100) })}</Text>
                </View>
              )}
            </View>
          );
        })}
      </Group>
      <Text style={styles.footnote}>{t('friends.quorum', { count: quorumFor(list.length) })}</Text>

      <Group index={1} title={t('friends.sharing')}>
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={styles.rowLabel}>{t('friends.shareRatings')}</Text>
            <Text style={styles.hint}>{t(shareRatings ? 'friends.shareRatingsOn' : 'friends.shareRatingsOff', { count: rated })}</Text>
          </View>
          <Switch
            value={shareRatings}
            onValueChange={(v) => {
              haptics.select();
              setShareRatings(v);
            }}
          />
        </View>
      </Group>

      <Group index={2} title={t('friends.you')}>
        <View style={styles.block}>
          <Identity name={name} emoji={emoji} onName={setName} onEmoji={setEmoji} />
          <Button label={t('common.save')} compact onPress={save} loading={saving} disabled={!name.trim() || (name.trim() === self?.name && emoji === self?.emoji)} style={{ alignSelf: 'flex-start' }} />
        </View>
      </Group>

      <FadeIn index={3} style={{ marginTop: 26, gap: 8 }}>
        <Button label={t(sure ? 'friends.leaveSure' : 'friends.leave')} icon="trash" variant="danger" compact onPress={leave} loading={leaving} style={{ alignSelf: 'flex-start' }} />
        <Text style={styles.hint}>{t('friends.leaveHint')}</Text>
      </FadeIn>
    </>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  root: { flex: 1, backgroundColor: palette.screen, alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 4 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  intro: { marginTop: 18, gap: 6 },
  introTitle: { ...type.title },
  introBody: { ...type.body, color: palette.inkSoft, lineHeight: 22 },
  groupTitle: { ...type.label, marginLeft: 4 },
  group: { borderRadius: radii.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline, overflow: 'hidden' },
  block: { padding: 14, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 },
  line: { borderBottomWidth: 1, borderBottomColor: palette.hairline },
  rowLabel: { ...fonts.medium, fontSize: 15, color: palette.ink },
  hint: { ...type.small, fontSize: 12.5, lineHeight: 17 },
  face: { fontSize: 26 },
  affinity: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: palette.primaryTint },
  affinityText: { ...fonts.semibold, fontSize: 12, color: palette.primaryText },
  input: { height: 44, borderRadius: 12, paddingHorizontal: 12, backgroundColor: palette.field, borderWidth: 1, borderColor: 'transparent', ...fonts.body, fontSize: 15, color: palette.ink },
  emojis: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  emoji: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.field, borderWidth: 1, borderColor: 'transparent' },
  emojiOn: { backgroundColor: palette.primaryTint, borderColor: palette.primaryRing },
  emojiText: { fontSize: 20 },
  footnote: { ...type.small, fontSize: 12, marginTop: 10, marginHorizontal: 4, lineHeight: 17 },
}));
