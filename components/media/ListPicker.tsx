import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/Button';
import CheckButton from '@/components/ui/CheckButton';
import PressableScale from '@/components/ui/PressableScale';
import Sheet from '@/components/ui/Sheet';
import { makeStyles, noOutline, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { Field } from '@/spark';
import { ListItem, itemKey, useLists } from '@/store/useLists';

export const LIST_EMOJI = ['📌', '🍿', '🎃', '💞', '🌙', '🔥', '🧠', '🎄', '☀️', '🏆', '📚', '🎮'];

/** Which of your lists this title is on: tick to add or take it off, or start a new list with it. */
export default function ListPicker({ item, visible, onClose }: { item: Omit<ListItem, 'addedAt'>; visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const haptics = useHaptics();
  const lists = useLists((s) => s.lists);
  const sorted = useMemo(() => Object.values(lists).sort((a, b) => b.createdAt - a.createdAt), [lists]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(LIST_EMOJI[0]);
  const key = itemKey(item);

  useEffect(() => {
    if (!visible) {
      setCreating(false);
      setName('');
    } else if (!sorted.length) setCreating(true);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = () => {
    if (!name.trim()) return;
    const id = useLists.getState().create(name, emoji);
    useLists.getState().toggle(id, item);
    haptics.success();
    setCreating(false);
    setName('');
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('lists.addTo')} subtitle={item.title}>
      {sorted.map((l) => {
        const on = l.items.some((i) => itemKey(i) === key);
        const toggle = () => {
          useLists.getState().toggle(l.id, item) ? haptics.success() : haptics.tap();
        };
        return (
          <PressableScale key={l.id} depth={0.98} onPress={toggle} style={styles.row} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={l.name}>
            <Text style={styles.emoji}>{l.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {l.name}
              </Text>
              <Text style={styles.count}>{t('lists.count', { count: l.items.length })}</Text>
            </View>
            <CheckButton checked={on} onPress={toggle} size={30} label={l.name} />
          </PressableScale>
        );
      })}
      {creating ? (
        <NewList name={name} setName={setName} emoji={emoji} setEmoji={setEmoji} onCreate={create} />
      ) : (
        <Button label={t('lists.new')} icon="plus" variant="secondary" onPress={() => setCreating(true)} />
      )}
    </Sheet>
  );
}

/** A name and an emoji for a new list (or a list being renamed). */
export function NewList({ name, setName, emoji, setEmoji, onCreate, cta }: { name: string; setName: (s: string) => void; emoji: string; setEmoji: (e: string) => void; onCreate: () => void; cta?: string }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const { palette } = useTheme();
  const appear = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(appear, { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 220 }).start();
  }, [appear]);
  return (
    <Animated.View style={[styles.create, { opacity: appear, transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
      <View style={styles.emojis}>
        {LIST_EMOJI.map((e) => (
          <PressableScale key={e} depth={0.85} onPress={() => setEmoji(e)} style={[styles.emojiPick, e === emoji && { backgroundColor: palette.primaryTint, borderColor: palette.primaryRing }]} accessibilityLabel={e} accessibilityState={{ selected: e === emoji }}>
            <Text style={{ fontSize: 20 }}>{e}</Text>
          </PressableScale>
        ))}
      </View>
      <Field value={name} onChangeText={setName} placeholder={t('lists.namePlaceholder')} maxLength={40} autoFocus returnKeyType="done" onSubmitEditing={onCreate} style={noOutline} accessibilityLabel={t('lists.name')} />
      <Button label={cta ?? t('lists.create')} icon="check" onPress={onCreate} disabled={!name.trim()} />
    </Animated.View>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radii.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  emoji: { fontSize: 24, width: 32, textAlign: 'center' },
  name: { ...fonts.semibold, fontSize: 15.5, color: palette.ink },
  count: { ...type.small, fontSize: 12.5 },
  create: { gap: 12, paddingTop: 4 },
  emojis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  emojiPick: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent', backgroundColor: palette.field },
}));
