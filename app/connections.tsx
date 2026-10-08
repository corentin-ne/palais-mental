import { useState } from 'react';
import { Platform, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import PressableScale from '@/components/ui/PressableScale';
import { Section } from '@/components/ui/Screen';
import { FadeIn } from '@/components/ui/Motion';
import { makeStyles, noOutline, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { useLayout } from '@/hooks/useLayout';
import { pickFiles } from '@/lib/backup';
import { SyncResult, exportForAnimeList, exportForLetterboxd, importExportFiles, syncService } from '@/lib/connect';
import { relativeDay, timeOf } from '@/lib/format';
import { refreshRelated } from '@/lib/related';
import { SERVICES, Service, useConnections } from '@/store/useConnections';
import { useUi } from '@/store/useUi';

const NAMES: Record<Service, string> = { letterboxd: 'Letterboxd', serializd: 'Serializd', mal: 'MyAnimeList', anilist: 'AniList' };

/** Other trackers, read through public profiles and export files: no keys, no passwords. */
export default function ConnectionsScreen() {
  const { t } = useTranslation();
  const { palette, type } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const { gutter, content } = useLayout();
  const autoSync = useConnections((s) => s.autoSync);
  const [busy, setBusy] = useState<string>();
  const [progress, setProgress] = useState<[number, number]>();
  const [last, setLast] = useState<SyncResult>();
  const toast = useUi((s) => s.showToast);

  const run = async (id: string, job: () => Promise<SyncResult>) => {
    setBusy(id);
    setProgress(undefined);
    try {
      const result = await job();
      setLast(result);
      haptics.success();
      toast(t('connect.synced', { added: result.added, updated: result.updated }));
      refreshRelated(true);
    } catch {
      toast(t('connect.failed'));
    } finally {
      setBusy(undefined);
      setProgress(undefined);
    }
  };

  const onImportFiles = async () => {
    const files = await pickFiles(true).catch(() => []);
    if (!files.length) return;
    run('files', () => importExportFiles(files, (d, n) => setProgress([d, n])));
  };

  const onExport = async (service: Exclude<Service, 'serializd'>) => {
    setBusy(`export-${service}`);
    setProgress(undefined);
    try {
      const count = service === 'letterboxd' ? await exportForLetterboxd() : await exportForAnimeList(service, (d, n) => setProgress([d, n]));
      toast(t('connect.exported', { count }));
    } catch {
      toast(t('profile.exportFailed'));
    } finally {
      setBusy(undefined);
      setProgress(undefined);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8, paddingHorizontal: gutter, width: content }]}>
        <PressableScale onPress={() => router.back()} style={styles.back} accessibilityLabel={t('common.back')}>
          <Icon name="back" size={20} color={palette.ink} strokeWidth={2.2} />
        </PressableScale>
        <Text style={type.hero}>{t('connect.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingHorizontal: gutter, width: content, alignSelf: 'center' }}>
        <Text style={styles.intro}>{t('connect.intro')}</Text>
        {Platform.OS === 'web' && <Text style={[styles.intro, { color: palette.danger }]}>{t('connect.web')}</Text>}

        {busy && progress && progress[1] > 0 && (
          <FadeIn style={styles.progress}>
            <Text style={styles.progressText}>{t('connect.progress', { done: progress[0], total: progress[1] })}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round((progress[0] / progress[1]) * 100)}%` }]} />
            </View>
          </FadeIn>
        )}

        {SERVICES.map((service, i) => (
          <FadeIn key={service} index={i}>
            <ServiceCard
              service={service}
              busy={busy}
              onSync={() => run(service, () => syncService(service, (d, n) => setProgress([d, n])))}
              onExport={service === 'serializd' ? undefined : () => onExport(service)}
            />
          </FadeIn>
        ))}

        <View style={[styles.card, styles.row]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t('connect.auto')}</Text>
            <Text style={styles.hint}>{t('connect.autoHint')}</Text>
          </View>
          <Switch value={autoSync} trackColor={{ true: palette.primary, false: palette.fieldActive }} thumbColor="#fff" onValueChange={(v) => useConnections.getState().setAutoSync(v)} />
        </View>

        <Section title={t('connect.files')}>
          <View style={styles.card}>
            <Text style={styles.hint}>{t('connect.filesHint')}</Text>
            <Button label={t('connect.pickFiles')} icon="upload" variant="secondary" onPress={onImportFiles} loading={busy === 'files'} disabled={!!busy && busy !== 'files'} />
          </View>
        </Section>

        {last && last.unmatched.length > 0 && (
          <Section title={t('connect.unmatched', { count: last.unmatched.length })}>
            <View style={styles.card}>
              <Text style={styles.hint}>{t('connect.unmatchedHint')}</Text>
              <Text style={styles.unmatched}>{last.unmatched.slice(0, 40).join(' · ')}</Text>
            </View>
          </Section>
        )}
      </ScrollView>
    </View>
  );
}

function ServiceCard({ service, busy, onSync, onExport }: { service: Service; busy?: string; onSync: () => void; onExport?: () => void }) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const account = useConnections((s) => s.accounts[service]);
  const [draft, setDraft] = useState('');
  const connect = () => {
    const username = draft.trim().replace(/^@/, '');
    if (!username) return;
    useConnections.getState().setAccount(service, { username });
    setDraft('');
    setTimeout(onSync, 0);
  };
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Icon name="link" size={20} color={palette.ink} />
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{NAMES[service]}</Text>
          <Text style={styles.hint}>{t(`connect.${service}Hint`)}</Text>
        </View>
        {account && (
          <View style={[styles.pill, account.lastError && { backgroundColor: palette.primaryTint }]}>
            <Text style={[styles.pillText, account.lastError && { color: palette.danger }]}>{account.lastError ? t('connect.error') : '@' + account.username}</Text>
          </View>
        )}
      </View>
      {account ? (
        <>
          {!!account.lastSync && (
            <Text style={styles.hint}>
              {t('connect.lastSync', { when: `${relativeDay(account.lastSync)} ${timeOf(account.lastSync)}`, changes: account.lastChanges ?? 0 })}
            </Text>
          )}
          <View style={styles.buttons}>
            <Button label={t('connect.sync')} icon="refresh" compact onPress={onSync} loading={busy === service} disabled={!!busy && busy !== service} />
            {onExport && (
              <Button label={t('connect.export')} icon="download" variant="secondary" compact onPress={onExport} loading={busy === `export-${service}`} disabled={!!busy && busy !== `export-${service}`} />
            )}
            <Button label={t('connect.disconnect')} variant="ghost" compact onPress={() => useConnections.getState().setAccount(service, null)} disabled={!!busy} />
          </View>
          <Text style={styles.footnote}>{t(service === 'letterboxd' ? 'connect.exportLetterboxd' : service === 'serializd' ? 'connect.exportSerializd' : 'connect.exportAnime')}</Text>
        </>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('connect.username')}
            placeholderTextColor={palette.inkFaint}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, noOutline]}
            onSubmitEditing={connect}
          />
          <Button label={t('connect.connect')} compact onPress={connect} disabled={!draft.trim() || !!busy} />
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  root: { flex: 1, backgroundColor: palette.screen, alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 8 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  intro: { ...type.small, fontSize: 13.5, lineHeight: 19, marginTop: 6, marginBottom: 6 },
  card: { marginTop: 12, padding: 16, gap: 12, borderRadius: radii.lg, backgroundColor: palette.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  label: { fontFamily: fonts.medium, fontSize: 15, color: palette.ink },
  hint: { ...type.small, fontSize: 12.5, lineHeight: 17 },
  footnote: { ...type.small, fontSize: 11.5, lineHeight: 16, color: palette.inkFaint },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { flex: 1, height: 40, borderRadius: 12, paddingHorizontal: 12, backgroundColor: palette.field, fontFamily: fonts.body, fontSize: 14, color: palette.ink },
  pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: palette.successTint },
  pillText: { fontFamily: fonts.semibold, fontSize: 11, color: palette.success },
  progress: { marginTop: 12, padding: 14, gap: 8, borderRadius: radii.lg, backgroundColor: palette.primaryTint },
  progressText: { fontFamily: fonts.medium, fontSize: 13, color: palette.primary },
  track: { height: 4, borderRadius: 2, backgroundColor: palette.surface, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: palette.primary },
  unmatched: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: palette.inkSoft },
}));
