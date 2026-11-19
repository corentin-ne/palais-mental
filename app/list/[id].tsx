import { useState } from 'react';
import { ScrollView, Share, Text, View } from 'react-native';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { NewList } from '@/components/media/ListPicker';
import Button from '@/components/ui/Button';
import Empty from '@/components/ui/Empty';
import Icon from '@/components/ui/Icon';
import Poster from '@/components/ui/Poster';
import PressableScale from '@/components/ui/PressableScale';
import Sheet from '@/components/ui/Sheet';
import { FadeIn, animateLayout } from '@/components/ui/Motion';
import { Header, useStyles as useListStyles } from '@/components/ui/SettingsList';
import { makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { useLayout } from '@/hooks/useLayout';
import { Aurora } from '@/spark';
import { ListItem, itemKey, useLists } from '@/store/useLists';
import { useUi } from '@/store/useUi';

/** One list: a poster wall in the order you added things. Hold a poster to take it off; rename, share or delete from the top. */
export default function ListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const list = useListStyles();
  const styles = useStyles();
  const router = useRouter();
  const haptics = useHaptics();
  const insets = useSafeAreaInsets();
  const { gutter, content, columns, poster, gap } = useLayout();
  const data = useLists((s) => s.lists[id]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');

  if (!data) {
    return (
      <View style={list.root}>
        <Aurora />
        <Header title={t('lists.title')} top={insets.top} gutter={gutter} width={content} onBack={() => router.back()} backLabel={t('common.back')} />
        <Empty icon="bookmark" title={t('lists.gone')} />
      </View>
    );
  }

  const removeItem = (item: ListItem) => {
    haptics.tap();
    animateLayout();
    useLists.getState().toggle(id, item);
    useUi.getState().showToast(t('lists.removedFrom', { title: item.title, list: data.name }), () => {
      const now = useLists.getState().lists[id];
      if (now && !now.items.some((i) => itemKey(i) === itemKey(item))) useLists.getState().restore({ ...now, items: [...now.items, item].sort((a, b) => b.addedAt - a.addedAt) });
    });
  };
  const removeList = () => {
    const removed = useLists.getState().remove(id);
    router.back();
    if (removed) useUi.getState().showToast(t('lists.deleted', { name: removed.name }), () => useLists.getState().restore(removed));
  };
  const share = () => {
    const lines = data.items.map((i) => `• ${i.title}${i.year ? ` (${i.year})` : ''}`);
    Share.share({ message: [`${data.emoji} ${data.name}`, ...lines].join('\n'), title: data.name }).catch(() => undefined);
  };
  // Less space for the posters than the library wall: a list rarely runs long.
  const w = Math.min(poster, 150);
  const cols = Math.max(3, Math.min(columns, Math.floor((content - gutter * 2 + gap) / (w + gap))));

  return (
    <View style={list.root}>
      <Aurora />
      <Header title={`${data.emoji} ${data.name}`} top={insets.top} gutter={gutter} width={content} onBack={() => router.back()} backLabel={t('common.back')} />
      <ScrollView style={{ width: content }} contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + 48 }}>
        <View style={styles.actions}>
          <Text style={styles.count}>{t('lists.count', { count: data.items.length })}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Button
              label={t('lists.rename')}
              icon="edit"
              variant="secondary"
              compact
              iconOnly
              onPress={() => {
                setName(data.name);
                setEmoji(data.emoji);
                setEditing(true);
              }}
            />
            {data.items.length > 0 && <Button label={t('detail.share')} icon="share" variant="secondary" compact iconOnly onPress={share} />}
            <Button label={t('lists.delete')} icon="trash" variant="danger" compact iconOnly onPress={removeList} />
          </View>
        </View>
        {data.items.length === 0 ? (
          <Empty icon="bookmark" title={t('lists.emptyList')} body={t('lists.emptyListBody')} cta={t('welcome.cta')} onPress={() => router.push('/search')} />
        ) : (
          <>
            <View style={[styles.wall, { gap }]}>
              {data.items.map((item, i) => (
                <FadeIn key={itemKey(item)} index={i} style={{ width: Math.floor((content - gutter * 2 - gap * (cols - 1)) / cols) }}>
                  <PressableScale
                    onPress={() => router.push(`/${item.kind}/${item.id}` as Href)}
                    onLongPress={() => removeItem(item)}
                    delayLongPress={350}
                    style={{ gap: 6 }}
                    accessibilityLabel={item.title}
                    accessibilityHint={t('lists.holdToRemove')}
                  >
                    <Poster uri={item.poster} title={item.title} width={Math.floor((content - gutter * 2 - gap * (cols - 1)) / cols)} kind={item.kind} />
                    <Text style={styles.title} numberOfLines={1}>
                      {item.title}
                    </Text>
                  </PressableScale>
                </FadeIn>
              ))}
            </View>
            <HoldHint />
          </>
        )}
      </ScrollView>
      <Sheet visible={editing} onClose={() => setEditing(false)} title={t('lists.rename')}>
        <NewList
          name={name}
          setName={setName}
          emoji={emoji}
          setEmoji={setEmoji}
          cta={t('common.save')}
          onCreate={() => {
            useLists.getState().rename(id, name, emoji);
            setEditing(false);
          }}
        />
      </Sheet>
    </View>
  );
}

function HoldHint() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.hint}>
      <Icon name="info" size={14} color={palette.inkFaint} />
      <Text style={styles.hintText}>{t('lists.holdToRemove')}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts, type }) => ({
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  count: { ...type.small },
  wall: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16 },
  title: { ...fonts.medium, fontSize: 12.5, color: palette.ink },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 22 },
  hintText: { ...type.small, fontSize: 12 },
}));
