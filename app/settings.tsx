import { useState } from 'react';
import { Linking, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';

import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import PressableScale from '@/components/ui/PressableScale';
import Segmented from '@/components/ui/Segmented';
import { ActionRow, Block, Group, Header, Row, Tile, useStyles as useSharedStyles } from '@/components/ui/SettingsList';
import { makeStyles, noOutline, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { useLayout } from '@/hooks/useLayout';
import { validateTmdbKey } from '@/lib/api';
import { refreshRelated } from '@/lib/related';
import { refreshLibrary, requestNotifications, scheduleNotifications } from '@/lib/sync';
import type { LanguagePreference } from '@/locales/i18n';
import type { Settings } from '@/lib/types';
import { RELEASES_PAGE, checkForUpdate } from '@/lib/updates';
import { useLibrary } from '@/store/useLibrary';
import { useUi } from '@/store/useUi';
import { Aurora, Switch } from '@/spark';

/** Everything that changes how the app behaves; your data has its own page. */
export default function SettingsScreen() {
  const { t } = useTranslation();
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

  // Android installs come from GitHub releases: ask for a newer one now. Elsewhere, the releases page.
  const [checking, setChecking] = useState(false);
  const onCheckUpdates = async () => {
    if (Platform.OS !== 'android') {
      Linking.openURL(RELEASES_PAGE).catch(() => undefined);
      return;
    }
    setChecking(true);
    try {
      const update = await checkForUpdate(true);
      if (update) useUi.getState().setUpdate(update);
      else toast(t('settings.upToDate'));
    } catch {
      toast(t('settings.updateFailed'));
    } finally {
      setChecking(false);
    }
  };

  const toggle = (value: boolean, onChange: (v: boolean) => void, disabled?: boolean) => (
    <Switch value={value} disabled={disabled} onValueChange={onChange} />
  );

  return (
    <View style={styles.root}>
      <Aurora />
      <Header title={t('settings.title')} top={insets.top} gutter={gutter} width={content} onBack={() => router.back()} backLabel={t('common.back')} />
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
          <Block icon="palette" tint="" label={t('settings.accent')}>
            <AccentPicker />
          </Block>
          <Block icon="sparkle" tint="" label={t('settings.quality')}>
            <Segmented<Settings['fx']>
              value={settings.fx}
              onChange={(fx) => setSettings({ fx })}
              options={[
                { value: 'full', label: t('settings.qualityFull') },
                { value: 'lite', label: t('settings.qualityLite') },
              ]}
            />
            <Text style={styles.rowHint}>{t('settings.qualityHint')}</Text>
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

        <Group index={2} title={t('profile.data')}>
          <ActionRow icon="download" tint="#0B63CE" label={t('profile.data')} hint={t('data.hint')} onPress={() => router.push('/data' as never)} last />
        </Group>

        <Group index={3} title={t('settings.services')}>
          <TmdbKey />
        </Group>
        <Text style={styles.footnote}>{t('profile.sourcesNote')}</Text>

        <Group index={4} title={t('settings.about')}>
          <ActionRow
            icon="download"
            tint=""
            label={t('settings.checkUpdates')}
            hint={checking ? t('settings.checking') : t('settings.versionN', { version: Constants.expoConfig?.version ?? '' })}
            onPress={onCheckUpdates}
            last
          />
        </Group>
        <Text style={styles.version}>Palais Mental {Constants.expoConfig?.version ?? ''}</Text>
      </ScrollView>
    </View>
  );
}

/** Accent colours to pick from: every decorative colour of the app derives from the one chosen. */
const ACCENTS = ['#3987e5', '#6d5ce8', '#a855f7', '#e0518c', '#f0614c', '#f59e0b', '#22a35a', '#14a3b8', '#64748b'];

function AccentPicker() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const haptics = useHaptics();
  const accent = useLibrary((s) => s.settings.accent) || ACCENTS[0];
  const setSettings = useLibrary((s) => s.setSettings);
  return (
    <View style={styles.swatches} accessibilityRole="radiogroup">
      {ACCENTS.map((c, i) => {
        const on = c.toLowerCase() === accent.toLowerCase();
        return (
          <PressableScale
            key={c}
            depth={0.88}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t('settings.accentN', { n: i + 1 })}
            onPress={() => {
              haptics.select();
              setSettings({ accent: i === 0 ? '' : c });
            }}
            style={[styles.swatchRing, on && { borderColor: palette.ink }]}
          >
            <View style={[styles.swatch, { backgroundColor: c }]}>{on && <Icon name="check" size={16} color="#fff" strokeWidth={2.8} />}</View>
          </PressableScale>
        );
      })}
    </View>
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

const useLocalStyles = makeStyles(({ palette, fonts, type }) => ({
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatchRing: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, height: 40, borderRadius: 12, paddingHorizontal: 12, backgroundColor: palette.field, borderWidth: 1, borderColor: 'transparent', ...fonts.body, fontSize: 14, color: palette.ink },
  link: { ...fonts.semibold, fontSize: 13, color: palette.primaryText },
  on: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: palette.successTint },
  onText: { ...fonts.semibold, fontSize: 11, color: palette.success },
  version: { ...type.small, fontSize: 12, textAlign: 'center', marginTop: 32, color: palette.inkFaint },
}));

const useStyles = () => ({ ...useSharedStyles(), ...useLocalStyles() });
