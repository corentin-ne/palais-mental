import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { makeStyles, useTheme } from '@/constants/theme';
import { Update, checkForUpdate } from '@/lib/updates';
import { Button, Glass, Icon } from '@/spark';

/** At launch, when a newer release is out: what it is, and a way to download it. Later closes it until next launch. */
export default function UpdatePrompt() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const [update, setUpdate] = useState<Update>();

  useEffect(() => {
    // A moment after opening: the first screen comes first.
    const timer = setTimeout(() => checkForUpdate().then(setUpdate), 2500);
    return () => clearTimeout(timer);
  }, []);

  if (!update) return null;
  const close = () => setUpdate(undefined);
  return (
    <Modal transparent animationType="fade" visible onRequestClose={close} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={close} accessibilityLabel={t('update.later')} />
      <View style={styles.center} pointerEvents="box-none">
        <Glass tone="strong" blur elevated="lg" radius={24} style={styles.card}>
          <View style={styles.tile}>
            <Icon name="download" size={24} color={palette.primaryText} />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {t('update.title', { version: update.version })}
          </Text>
          <Text style={styles.body}>{t('update.body', { current: update.current })}</Text>
          <Button
            label={t('update.download')}
            icon="download"
            variant="primary"
            size="lg"
            block
            onPress={() => {
              Linking.openURL(update.url).catch(() => undefined);
              close();
            }}
          />
          <View style={styles.row}>
            <Button label={t('update.notes')} variant="ghost" size="sm" onPress={() => Linking.openURL(update.page).catch(() => undefined)} />
            <Button label={t('update.later')} variant="ghost" size="sm" onPress={close} />
          </View>
        </Glass>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(({ palette, type }) => ({
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  center: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 400, padding: 22, gap: 12, alignItems: 'center' },
  tile: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primaryTint },
  title: { ...type.title, textAlign: 'center' },
  body: { ...type.body, color: palette.inkSoft, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 8 },
}));
