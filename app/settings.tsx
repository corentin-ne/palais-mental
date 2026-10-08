import { ReactNode, useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';

import Button from '@/components/ui/Button';
import Icon, { IconName } from '@/components/ui/Icon';
import PressableScale from '@/components/ui/PressableScale';
import Segmented from '@/components/ui/Segmented';
import { FadeIn } from '@/components/ui/Motion';
import { makeStyles, noOutline, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { useLayout } from '@/hooks/useLayout';
import { validateTmdbKey } from '@/lib/api';
import { ExportKind, Snapshot, autoSnapshot, exportData, listSnapshots, pickBackup, restoreSnapshot } from '@/lib/backup';
import { fullDate } from '@/lib/format';
import { refreshRelated } from '@/lib/related';
import { refreshLibrary, requestNotifications, scheduleNotifications } from '@/lib/sync';
import type { LanguagePreference } from '@/locales/i18n';
import type { Settings } from '@/lib/types';
import { useLibrary } from '@/store/useLibrary';
import { useUi } from '@/store/useUi';

/** Everything that changes how the app behaves, and your data to take anywhere. */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const { palette, type } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const { gutter, content } = useLayout();
  const settings = useLibrary((s) => s.settings);
  const language = useLibrary((s) => s.language);
  const setSettings = useLibrary((s) => s.setSettings);
  const setLanguage = useLibrary((s) => s.setLanguage);
  const toast = useUi((s) => s.showToast);

  const onExport = async (kind: ExportKind) => {
    try {
      await exportData(kind);
      haptics.success();
    } catch {
      toast(t('profile.exportFailed'));
    }
  };

  const onImport = async () => {
    try {
      const data = await pickBackup();
      if (!data) return;
      useLibrary.getState().importData(data, 'merge');
      haptics.success();
      toast(
        t('profile.imported', {
          shows: Object.keys(data.shows).length,
          movies: Object.keys(data.movies).length,
          books: Object.keys(data.books ?? {}).length,
          games: Object.keys(data.games ?? {}).length,
        }),
      );
      refreshLibrary(true);
    } catch {
      toast(t('profile.importFailed'));
    }
  };

  const toggle = (value: boolean, onChange: (v: boolean) => void, disabled?: boolean) => (
    <Switch value={value} disabled={disabled} trackColor={{ true: palette.primary, false: palette.fieldActive }} thumbColor="#fff" onValueChange={onChange} />
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8, paddingHorizontal: gutter, width: content }]}>
        <PressableScale onPress={() => router.back()} style={styles.back} accessibilityLabel={t('common.back')}>
          <Icon name="back" size={20} color={palette.ink} strokeWidth={2.2} />
        </PressableScale>
        <Text style={type.hero}>{t('settings.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 48, paddingHorizontal: gutter, width: content, alignSelf: 'center' }}>
        <Group index={0} title={t('settings.general')}>
          <Row icon="bell" tint="#E8833A" label={t('profile.notifications')} hint={Platform.OS === 'web' ? t('profile.notificationsWeb') : t('profile.notificationsHint')}>
            {toggle(
              settings.notifications,
              async (v) => {
                haptics.select();
                setSettings({ notifications: v });
                if (v) await requestNotifications();
                scheduleNotifications();
              },
              Platform.OS === 'web',
            )}
          </Row>
          <Row icon="movies" tint="#8A5CF6" label={t('related.setting')} hint={t('related.settingHint')} last={Platform.OS === 'web'}>
            {toggle(settings.related, (v) => {
              haptics.select();
              setSettings({ related: v });
              if (v) refreshRelated(true);
            })}
          </Row>
          {Platform.OS !== 'web' && (
            <Row icon="sparkle" tint="#E0518C" label={t('profile.haptics')} last>
              {toggle(settings.haptics, (v) => setSettings({ haptics: v }))}
            </Row>
          )}
        </Group>

        <Group index={1} title={t('settings.look')}>
          <Block icon="eye" tint="#2F9E6A" label={t('profile.appearance')}>
            <Segmented<Settings['appearance']>
              value={settings.appearance}
              onChange={(appearance) => setSettings({ appearance })}
              options={[
                { value: 'system', label: t('profile.system') },
                { value: 'light', label: t('profile.light') },
                { value: 'dark', label: t('profile.dark') },
              ]}
            />
          </Block>
          <Block icon="globe" tint="#0B63CE" label={t('profile.language')} last>
            <Segmented<LanguagePreference>
              value={language}
              onChange={setLanguage}
              options={[
                { value: 'system', label: t('profile.system') },
                { value: 'en', label: 'English' },
                { value: 'fr', label: 'Français' },
              ]}
            />
          </Block>
        </Group>

        <Group index={2} title={t('settings.services')}>
          <ActionRow icon="link" tint="#14A3B8" label={t('connect.title')} hint={t('connect.rowHint')} onPress={() => router.push('/connections')} />
          <TmdbKey />
        </Group>
        <Text style={styles.footnote}>{t('profile.sourcesNote')}</Text>

        <Group index={3} title={t('profile.data')}>
          <ActionRow icon="download" tint="#0B63CE" label={t('profile.exportJson')} hint={t('profile.exportJsonHint')} onPress={() => onExport('json')} />
          <ActionRow icon="upload" tint="#0B63CE" label={t('profile.import')} hint={t('profile.importHint')} onPress={onImport} last />
        </Group>
        <Group index={4} title={t('settings.csv')}>
          <ActionRow icon="series" tint="#5B6B7F" label={t('profile.exportShows')} onPress={() => onExport('shows-csv')} />
          <ActionRow icon="movies" tint="#5B6B7F" label={t('profile.exportMovies')} onPress={() => onExport('movies-csv')} />
          <ActionRow icon="journal" tint="#5B6B7F" label={t('profile.exportBooks')} onPress={() => onExport('books-csv')} />
          <ActionRow icon="play" tint="#5B6B7F" label={t('profile.exportGames')} onPress={() => onExport('games-csv')} last />
        </Group>
        <Snapshots />

        <Text style={styles.version}>Palais Mental {Constants.expoConfig?.version ?? ''}</Text>
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

/** A coloured tile behind each icon, so rows read at a glance. */
function Tile({ icon, tint }: { icon: IconName; tint: string }) {
  const styles = useStyles();
  return (
    <View style={[styles.tile, { backgroundColor: tint }]}>
      <Icon name={icon} size={17} color="#fff" strokeWidth={2} />
    </View>
  );
}

function Row({ icon, tint, label, hint, last, children }: { icon: IconName; tint: string; label: string; hint?: string; last?: boolean; children?: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={[styles.row, !last && styles.line]}>
      <Tile icon={icon} tint={tint} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {!!hint && <Text style={styles.rowHint}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

function Block({ icon, tint, label, last, children }: { icon: IconName; tint: string; label: string; last?: boolean; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={[styles.block, !last && styles.line]}>
      <View style={styles.rowHead}>
        <Tile icon={icon} tint={tint} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

function ActionRow({ onPress, ...row }: { icon: IconName; tint: string; label: string; hint?: string; last?: boolean; onPress: () => void }) {
  const { palette } = useTheme();
  return (
    <PressableScale depth={0.98} onPress={onPress} accessibilityLabel={row.label}>
      <Row {...row}>
        <Icon name="chevronRight" size={16} color={palette.inkFaint} />
      </Row>
    </PressableScale>
  );
}

/** Copies kept on the device every few days: merged back in, never replacing anything. */
function Snapshots() {
  const { t } = useTranslation();
  const styles = useStyles();
  const [list, setList] = useState<Snapshot[]>([]);
  useEffect(() => {
    autoSnapshot().then(listSnapshots).then(setList);
  }, []);
  if (!list.length) return null;
  return (
    <>
      <Group index={5} title={t('settings.snapshots')}>
        {list.map((s, i) => (
          <ActionRow
            key={s.at}
            icon="undo"
            tint="#5B6B7F"
            last={i === list.length - 1}
            label={t('profile.snapshot', { date: fullDate(s.at) })}
            hint={t('profile.snapshotCounts', { shows: s.shows, movies: s.movies, books: s.books ?? 0, games: s.games ?? 0 })}
            onPress={async () => {
              const ok = await restoreSnapshot(s.at);
              useUi.getState().showToast(t(ok ? 'profile.snapshotRestored' : 'profile.importFailed'));
              if (ok) refreshLibrary();
            }}
          />
        ))}
      </Group>
      <Text style={styles.footnote}>{t('profile.snapshotsHint')}</Text>
    </>
  );
}

/** Optional TMDB key: better film search, backdrops, cast and exact release dates. */
function TmdbKey() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const saved = useLibrary((s) => s.settings.tmdbKey);
  const setSettings = useLibrary((s) => s.setSettings);
  const [draft, setDraft] = useState(saved);
  const [state, setState] = useState<'idle' | 'checking' | 'bad'>('idle');
  const save = async () => {
    const key = draft.trim();
    if (!key) {
      setSettings({ tmdbKey: '' });
      return;
    }
    setState('checking');
    const ok = await validateTmdbKey(key);
    setState(ok ? 'idle' : 'bad');
    if (ok) {
      setSettings({ tmdbKey: key });
      useUi.getState().showToast(t('profile.tmdbSaved'));
      refreshLibrary(true);
    }
  };
  return (
    <View style={styles.block}>
      <View style={styles.rowHead}>
        <Tile icon="key" tint="#01B4E4" />
        <Text style={[styles.rowLabel, { flex: 1 }]}>{t('profile.tmdb')}</Text>
        {!!saved && (
          <View style={styles.on}>
            <Text style={styles.onText}>{t('profile.active')}</Text>
          </View>
        )}
      </View>
      <Text style={styles.rowHint}>{t('profile.tmdbHint')}</Text>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TextInput
          value={draft}
          onChangeText={(v) => {
            setDraft(v);
            setState('idle');
          }}
          placeholder={t('profile.tmdbPlaceholder')}
          placeholderTextColor={palette.inkFaint}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={!!saved && draft === saved}
          style={[styles.input, state === 'bad' && { borderColor: palette.danger }, noOutline]}
          onSubmitEditing={save}
        />
        <Button label={t('common.save')} compact onPress={save} loading={state === 'checking'} disabled={draft.trim() === saved} />
      </View>
      {state === 'bad' && <Text style={[styles.rowHint, { color: palette.danger }]}>{t('profile.tmdbBad')}</Text>}
      <PressableScale onPress={() => Linking.openURL('https://www.themoviedb.org/settings/api')} style={{ alignSelf: 'flex-start' }}>
        <Text style={styles.link}>{t('profile.tmdbGet')}</Text>
      </PressableScale>
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  root: { flex: 1, backgroundColor: palette.screen, alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 4 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  groupTitle: { ...type.label, marginLeft: 4 },
  group: { borderRadius: radii.lg, backgroundColor: palette.surface, overflow: 'hidden' },
  tile: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 },
  line: { borderBottomWidth: 1, borderBottomColor: palette.hairline },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  block: { padding: 14, gap: 12 },
  rowLabel: { fontFamily: fonts.medium, fontSize: 15, color: palette.ink },
  rowHint: { ...type.small, fontSize: 12.5, lineHeight: 17 },
  input: { flex: 1, height: 40, borderRadius: 12, paddingHorizontal: 12, backgroundColor: palette.field, borderWidth: 1, borderColor: 'transparent', fontFamily: fonts.body, fontSize: 14, color: palette.ink },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: palette.primary },
  on: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: palette.successTint },
  onText: { fontFamily: fonts.semibold, fontSize: 11, color: palette.success },
  footnote: { ...type.small, fontSize: 12, marginTop: 8, marginHorizontal: 4 },
  version: { ...type.small, fontSize: 12, textAlign: 'center', marginTop: 32, color: palette.inkFaint },
}));
