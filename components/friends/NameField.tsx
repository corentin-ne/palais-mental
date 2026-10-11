import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/Button';
import { makeStyles, noOutline, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { JoinError, joinFriends, rename } from '@/lib/friends';
import { useFriends } from '@/store/useFriends';
import { useUi } from '@/store/useUi';

/**
 * Your name, the one thing there is to an account here. Choosing one is what puts you in with the
 * others (Social); changing it later renames you everywhere.
 */
export default function NameField() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const haptics = useHaptics();
  const me = useFriends((s) => s.me);
  const current = useFriends((s) => (s.me ? s.members[s.me]?.name : undefined)) ?? '';
  const [draft, setDraft] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<JoinError>();
  useEffect(() => setDraft(current), [current]);

  const name = draft.trim();
  const save = async () => {
    if (!name || name === current) return;
    setBusy(true);
    setError(undefined);
    try {
      const failed = me ? await rename(name) : await joinFriends(name);
      if (failed) return setError(failed);
      haptics.success();
      useUi.getState().showToast(t(me ? 'friends.renamed' : 'friends.joined', { name }));
    } catch {
      setError('offline');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.row}>
        <TextInput
          value={draft}
          onChangeText={(v) => {
            setDraft(v);
            setError(undefined);
          }}
          placeholder={t('friends.namePlaceholder')}
          placeholderTextColor={palette.inkFaint}
          maxLength={24}
          autoCorrect={false}
          onSubmitEditing={save}
          style={[styles.input, noOutline]}
        />
        <Button label={t('common.save')} compact onPress={save} loading={busy} disabled={!name || name === current} />
      </View>
      {!me && <Text style={styles.hint}>{t('friends.nameHint')}</Text>}
      {!!error && <Text style={[styles.hint, { color: palette.danger }]}>{t(`friends.error.${error}`)}</Text>}
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts, type }) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, height: 44, borderRadius: 12, paddingHorizontal: 12, backgroundColor: palette.field, ...fonts.body, fontSize: 15, color: palette.ink },
  hint: { ...type.small, fontSize: 12.5, lineHeight: 17 },
}));
