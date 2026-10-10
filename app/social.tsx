import { ReactNode, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import NameField from '@/components/friends/NameField';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import PressableScale from '@/components/ui/PressableScale';
import { FadeIn } from '@/components/ui/Motion';
import { makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { useLayout } from '@/hooks/useLayout';
import { leaveFriends, setShareRatings, syncFriends } from '@/lib/friends';
import { quorumFor, useDigest } from '@/lib/ribbons';
import { Aurora, Switch } from '@/spark';
import { useFriends } from '@/store/useFriends';
import { useUi } from '@/store/useUi';

/** Social: who is there, what you share with them, and the way out. Choosing a name is all it takes to be in. */
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
        {me ? (
          <Joined me={me} />
        ) : (
          <>
            <FadeIn style={styles.intro}>
              <Text style={styles.introTitle}>{t('friends.introTitle')}</Text>
              <Text style={styles.introBody}>{t('friends.introBody')}</Text>
            </FadeIn>
            <Group index={1} title={t('friends.name')}>
              <View style={styles.block}>
                <NameField />
              </View>
            </Group>
          </>
        )}
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

function Joined({ me }: { me: string }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const haptics = useHaptics();
  const members = useFriends((s) => s.members);
  const ratings = useFriends((s) => s.ratings);
  const recos = useFriends((s) => s.recos);
  const shareRatings = useFriends((s) => s.shareRatings);
  const d = useDigest();
  const [leaving, setLeaving] = useState(false);
  const [sure, setSure] = useState(false);

  const list = Object.values(members).sort((a, b) => Number(b.id === me) - Number(a.id === me) || a.joinedAt - b.joinedAt);
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
      <Group index={0} title={t('friends.members', { count: list.length })}>
        {list.map((m, i) => {
          const affinity = d?.affinity.get(m.id);
          const counts = [
            t('friends.nRatings', { count: ratings.filter((r) => r.user === m.id).length }),
            t('friends.nRecos', { count: recos.filter((r) => r.user === m.id).length }),
          ].join(' · ');
          return (
            <View key={m.id} style={[styles.row, i < list.length - 1 && styles.line]}>
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
      </Group>

      <Group index={2} title={t('friends.name')}>
        <View style={styles.block}>
          <NameField />
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
  affinity: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: palette.primaryTint },
  affinityText: { ...fonts.semibold, fontSize: 12, color: palette.primaryText },
  footnote: { ...type.small, fontSize: 12, marginTop: 10, marginHorizontal: 4, lineHeight: 17 },
}));
