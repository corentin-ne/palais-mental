import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import Stepper from './Stepper';
import { theme } from '@/constants/theme';
import { CATEGORIES, CategoryId } from '@/lib/types';
import { CATEGORY_SPECS } from '@/lib/itemVisuals';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Fired as soon as a category is picked, so the camera flies while the user types. */
  onCategory: (category: CategoryId) => void;
  onSubmit: (category: CategoryId, title: string, episodeCount: number) => void;
}

export default function LogSheet({ visible, onClose, onCategory, onSubmit }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [title, setTitle] = useState('');
  const [episodes, setEpisodes] = useState(10);

  useEffect(() => {
    if (!visible) {
      setCategory(null);
      setTitle('');
      setEpisodes(10);
    }
  }, [visible]);

  const pick = (c: CategoryId) => {
    setCategory(c);
    onCategory(c);
  };

  const canSubmit = !!category && title.trim().length > 0;
  const submit = () => {
    if (!canSubmit) return;
    onSubmit(category!, title.trim(), episodes);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('log.cancel')} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.anchor} pointerEvents="box-none">
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.grabber} />
          {!category ? (
            <>
              <Text style={styles.heading}>{t('log.chooseCategory')}</Text>
              <View style={styles.grid}>
                {CATEGORIES.map((c) => (
                  <Pressable
                    key={c}
                    accessibilityRole="button"
                    onPress={() => pick(c)}
                    style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
                  >
                    <View style={[styles.dot, { backgroundColor: CATEGORY_SPECS[c].accent }]} />
                    <Text style={styles.tileText}>{t(`categories.${c}`)}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <>
              <View style={styles.headRow}>
                <Pressable accessibilityRole="button" onPress={() => setCategory(null)} hitSlop={12}>
                  <Text style={styles.link}>‹ {t('log.back')}</Text>
                </Pressable>
                <View style={[styles.dot, { backgroundColor: CATEGORY_SPECS[category].accent }]} />
                <Text style={styles.headingInline}>{t(`categories.${category}`)}</Text>
              </View>

              <Text style={styles.label}>{t('log.titleLabel')}</Text>
              <TextInput
                autoFocus
                value={title}
                onChangeText={setTitle}
                placeholder={t('log.titlePlaceholder', { example: t(`examples.${category}`) })}
                placeholderTextColor={theme.textFaint}
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={submit}
                maxLength={120}
              />

              {category === 'series' && (
                <View style={styles.stepperRow}>
                  <Text style={styles.label}>{t('log.episodesLabel')}</Text>
                  <Stepper value={episodes} onChange={setEpisodes} />
                </View>
              )}

              <Pressable
                accessibilityRole="button"
                disabled={!canSubmit}
                onPress={submit}
                style={({ pressed }) => [styles.primary, !canSubmit && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={styles.primaryText}>{t('log.submit')}</Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,236,214,0.35)' },
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.glass,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.glassBorder,
    paddingHorizontal: 20,
    paddingTop: 10,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: theme.glassBorder, marginBottom: 16 },
  heading: { color: theme.text, fontSize: 20, fontWeight: '600', marginBottom: 16, letterSpacing: 0.2 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  headingInline: { color: theme.text, fontSize: 18, fontWeight: '600' },
  link: { color: theme.textDim, fontSize: 15, marginRight: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.glassBorder,
    backgroundColor: theme.glassFill,
  },
  tileText: { color: theme.text, fontSize: 15, fontWeight: '500' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { color: theme.textDim, fontSize: 13, marginBottom: 8, letterSpacing: 0.3 },
  input: {
    color: theme.text,
    fontSize: 17,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.glassBorder,
    backgroundColor: theme.glassFill,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  primary: { backgroundColor: theme.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  primaryText: { color: theme.onPrimary, fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.7 },
});
