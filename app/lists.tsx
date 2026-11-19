import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Href, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { LIST_EMOJI, NewList } from '@/components/media/ListPicker';
import Button from '@/components/ui/Button';
import Empty from '@/components/ui/Empty';
import Poster from '@/components/ui/Poster';
import PressableScale from '@/components/ui/PressableScale';
import Sheet from '@/components/ui/Sheet';
import { FadeIn } from '@/components/ui/Motion';
import { Header, useStyles as useListStyles } from '@/components/ui/SettingsList';
import { makeStyles } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { Aurora } from '@/spark';
import { UserList, useLists } from '@/store/useLists';

/** Your lists, each as a little fan of its first posters. */
export default function ListsScreen() {
  const { t } = useTranslation();
  const list = useListStyles();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { gutter, content, inner, wide } = useLayout();
  const lists = useLists((s) => s.lists);
  const sorted = useMemo(() => Object.values(lists).sort((a, b) => b.createdAt - a.createdAt), [lists]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(LIST_EMOJI[0]);
  const cols = wide ? 3 : 2;
  const cardW = Math.floor((inner - 12 * (cols - 1)) / cols);

  const create = () => {
    if (!name.trim()) return;
    const id = useLists.getState().create(name, emoji);
    setCreating(false);
    setName('');
    router.push(`/list/${id}` as Href);
  };

  return (
    <View style={list.root}>
      <Aurora />
      <Header title={t('lists.title')} top={insets.top} gutter={gutter} width={content} onBack={() => router.back()} backLabel={t('common.back')} />
      <ScrollView style={{ width: content }} contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + 48 }}>
        {sorted.length === 0 ? (
          <Empty icon="bookmark" title={t('lists.emptyTitle')} body={t('lists.emptyBody')} cta={t('lists.new')} ctaIcon="plus" onPress={() => setCreating(true)} />
        ) : (
          <>
            <Button label={t('lists.new')} icon="plus" variant="secondary" compact onPress={() => setCreating(true)} style={{ alignSelf: 'flex-start', marginTop: 12 }} />
            <View style={styles.grid}>
              {sorted.map((l, i) => (
                <FadeIn key={l.id} index={i}>
                  <ListCard list={l} width={cardW} onPress={() => router.push(`/list/${l.id}` as Href)} />
                </FadeIn>
              ))}
            </View>
          </>
        )}
      </ScrollView>
      <Sheet visible={creating} onClose={() => setCreating(false)} title={t('lists.new')}>
        <NewList name={name} setName={setName} emoji={emoji} setEmoji={setEmoji} onCreate={create} />
      </Sheet>
    </View>
  );
}

/** A list's card: up to three posters fanned out over a glass tile, its emoji, name and count. */
export function ListCard({ list, width, onPress }: { list: UserList; width: number; onPress: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const covers = list.items.slice(0, 3);
  const pw = Math.round(width * 0.36);
  return (
    <PressableScale depth={0.97} onPress={onPress} style={[styles.card, { width }]} accessibilityLabel={`${list.name}, ${t('lists.count', { count: list.items.length })}`}>
      <View style={[styles.fan, { height: Math.round(pw * 1.5) + 12 }]}>
        {covers.length === 0 ? (
          <Text style={{ fontSize: 40 }}>{list.emoji}</Text>
        ) : (
          covers
            .map((c, i) => (
              <View
                key={c.kind + c.id}
                style={{
                  position: 'absolute',
                  transform: [{ translateX: (i - (covers.length - 1) / 2) * pw * 0.55 }, { rotate: `${(i - (covers.length - 1) / 2) * 9}deg` }, { translateY: Math.abs(i - (covers.length - 1) / 2) * 6 }],
                  zIndex: i === Math.floor(covers.length / 2) ? 2 : 1,
                }}
              >
                <Poster uri={c.poster} title={c.title} width={pw} kind={c.kind} radius={8} />
              </View>
            ))
        )}
      </View>
      <View style={{ gap: 2 }}>
        <Text style={styles.name} numberOfLines={1}>
          {`${list.emoji}  ${list.name}`}
        </Text>
        <Text style={styles.count}>{t('lists.count', { count: list.items.length })}</Text>
      </View>
    </PressableScale>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  card: { padding: 12, gap: 10, borderRadius: radii.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline, overflow: 'hidden' },
  fan: { alignItems: 'center', justifyContent: 'center' },
  name: { ...fonts.semibold, fontSize: 15, color: palette.ink },
  count: { ...type.small, fontSize: 12.5 },
}));
