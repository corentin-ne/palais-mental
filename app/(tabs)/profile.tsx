import { ReactNode, useMemo, useState } from 'react';
import { Linking, Platform, Switch, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import Button from '@/components/ui/Button';
import Icon, { IconName } from '@/components/ui/Icon';
import PressableScale from '@/components/ui/PressableScale';
import Screen, { Section } from '@/components/ui/Screen';
import Segmented from '@/components/ui/Segmented';
import { FadeIn, useCountUp } from '@/components/ui/Motion';
import { makeStyles, noOutline, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { useLayout } from '@/hooks/useLayout';
import { validateTmdbKey } from '@/lib/api';
import { ExportKind, exportData, pickBackup } from '@/lib/backup';
import { duration } from '@/lib/format';
import { minutesWatched } from '@/lib/progress';
import { refreshLibrary, requestNotifications, scheduleNotifications } from '@/lib/sync';
import type { LanguagePreference } from '@/locales/i18n';
import type { Settings } from '@/lib/types';
import { useLibrary } from '@/store/useLibrary';
import { useUi } from '@/store/useUi';

/** A few honest numbers, your settings, and your data to take anywhere. */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const haptics = useHaptics();
  const { wide } = useLayout();
  const shows = useLibrary((s) => s.shows);
  const movies = useLibrary((s) => s.movies);
  const settings = useLibrary((s) => s.settings);
  const language = useLibrary((s) => s.language);
  const setSettings = useLibrary((s) => s.setSettings);
  const setLanguage = useLibrary((s) => s.setLanguage);
  const toast = useUi((s) => s.showToast);
  const router = useRouter();

  const stats = useMemo(() => {
    const showList = Object.values(shows);
    const watchedMovies = Object.values(movies).filter((m) => m.watchedAt);
    return {
      episodes: showList.reduce((n, s) => n + Object.keys(s.watched).length, 0),
      showMinutes: showList.reduce((n, s) => n + minutesWatched(s), 0),
      films: watchedMovies.length,
      filmMinutes: watchedMovies.reduce((n, m) => n + (m.runtime ?? 0), 0),
    };
  }, [shows, movies]);

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
      toast(t('profile.imported', { shows: Object.keys(data.shows).length, movies: Object.keys(data.movies).length }));
      refreshLibrary(true);
    } catch {
      toast(t('profile.importFailed'));
    }
  };

  return (
    <Screen title={t('profile.title')}>
      <View style={[styles.stats, wide && { flexWrap: 'nowrap' }]}>
        <Stat index={0} icon="series" value={stats.episodes} label={t('profile.episodes')} />
        <Stat index={1} icon="clock" text={duration(stats.showMinutes)} label={t('profile.showTime')} />
        <Stat index={2} icon="movies" value={stats.films} label={t('profile.films')} />
        <Stat index={3} icon="clock" text={duration(stats.filmMinutes)} label={t('profile.filmTime')} />
      </View>

      <View style={[styles.group, { marginTop: 12 }]}>
        <ActionRow icon="clock" label={t('history.title')} hint={t('history.hint')} onPress={() => router.push('/history')} />
      </View>

      <Section title={t('profile.settings')}>
        <Group>
          <Row icon="bell" label={t('profile.notifications')} hint={Platform.OS === 'web' ? t('profile.notificationsWeb') : t('profile.notificationsHint')}>
            <Switch
              value={settings.notifications}
              disabled={Platform.OS === 'web'}
              trackColor={{ true: palette.primary, false: palette.fieldActive }}
              thumbColor="#fff"
              onValueChange={async (v) => {
                haptics.select();
                setSettings({ notifications: v });
                if (v) await requestNotifications();
                scheduleNotifications();
              }}
            />
          </Row>
          {Platform.OS !== 'web' && (
            <Row icon="sparkle" label={t('profile.haptics')}>
              <Switch value={settings.haptics} trackColor={{ true: palette.primary, false: palette.fieldActive }} thumbColor="#fff" onValueChange={(v) => setSettings({ haptics: v })} />
            </Row>
          )}
          <View style={[styles.block, styles.blockLine]}>
            <View style={styles.rowHead}>
              <Icon name="eye" size={20} color={palette.ink} />
              <Text style={styles.rowLabel}>{t('profile.appearance')}</Text>
            </View>
            <Segmented<Settings['appearance']>
              value={settings.appearance}
              onChange={(appearance) => setSettings({ appearance })}
              options={[
                { value: 'system', label: t('profile.system') },
                { value: 'light', label: t('profile.light') },
                { value: 'dark', label: t('profile.dark') },
              ]}
            />
          </View>
          <View style={styles.block}>
            <View style={styles.rowHead}>
              <Icon name="globe" size={20} color={palette.ink} />
              <Text style={styles.rowLabel}>{t('profile.language')}</Text>
            </View>
            <Segmented<LanguagePreference>
              value={language}
              onChange={setLanguage}
              options={[
                { value: 'system', label: t('profile.system') },
                { value: 'en', label: 'English' },
                { value: 'fr', label: 'Français' },
              ]}
            />
          </View>
        </Group>
      </Section>

      <Section title={t('profile.sources')}>
        <TmdbKey />
        <Text style={styles.footnote}>{t('profile.sourcesNote')}</Text>
      </Section>

      <Section title={t('profile.data')}>
        <Group>
          <ActionRow icon="download" label={t('profile.exportJson')} hint={t('profile.exportJsonHint')} onPress={() => onExport('json')} />
          <ActionRow icon="series" label={t('profile.exportShows')} onPress={() => onExport('shows-csv')} />
          <ActionRow icon="movies" label={t('profile.exportMovies')} onPress={() => onExport('movies-csv')} />
          <ActionRow icon="upload" label={t('profile.import')} hint={t('profile.importHint')} onPress={onImport} />
        </Group>
      </Section>
    </Screen>
  );
}

function Stat({ icon, value, text, label, index }: { icon: IconName; value?: number; text?: string; label: string; index: number }) {
  const styles = useStyles();
  const { palette } = useTheme();
  const shown = useCountUp(value ?? 0);
  return (
    <FadeIn index={index} style={styles.stat}>
      <Icon name={icon} size={18} color={palette.primary} />
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {text ?? Math.round(shown).toLocaleString()}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </FadeIn>
  );
}

function Group({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <View style={styles.group}>{children}</View>;
}

function Row({ icon, label, hint, children }: { icon: IconName; label: string; hint?: string; children: ReactNode }) {
  const styles = useStyles();
  const { palette } = useTheme();
  return (
    <View style={styles.row}>
      <Icon name={icon} size={20} color={palette.ink} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {!!hint && <Text style={styles.rowHint}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

function ActionRow({ icon, label, hint, onPress }: { icon: IconName; label: string; hint?: string; onPress: () => void }) {
  const { palette } = useTheme();
  return (
    <PressableScale depth={0.98} onPress={onPress} accessibilityLabel={label}>
      <Row icon={icon} label={label} hint={hint}>
        <Icon name="chevronRight" size={16} color={palette.inkFaint} />
      </Row>
    </PressableScale>
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
    <View style={styles.group}>
      <View style={styles.block}>
        <View style={styles.rowHead}>
          <Icon name="key" size={20} color={palette.ink} />
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
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  stat: { flexGrow: 1, flexBasis: '45%', padding: 16, gap: 6, borderRadius: radii.lg, backgroundColor: palette.surface },
  statValue: { fontFamily: fonts.bold, fontSize: 26, letterSpacing: -0.8, color: palette.ink },
  statLabel: { ...type.small },
  group: { borderRadius: radii.lg, backgroundColor: palette.surface, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.hairline },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  block: { padding: 16, gap: 12 },
  blockLine: { borderBottomWidth: 1, borderBottomColor: palette.hairline },
  rowLabel: { fontFamily: fonts.medium, fontSize: 15, color: palette.ink },
  rowHint: { ...type.small, fontSize: 12.5, lineHeight: 17 },
  input: { flex: 1, height: 40, borderRadius: 12, paddingHorizontal: 12, backgroundColor: palette.field, borderWidth: 1, borderColor: 'transparent', fontFamily: fonts.body, fontSize: 14, color: palette.ink },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: palette.primary },
  on: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: palette.successTint },
  onText: { fontFamily: fonts.semibold, fontSize: 11, color: palette.success },
  footnote: { ...type.small, fontSize: 12, marginTop: -4 },
}));
