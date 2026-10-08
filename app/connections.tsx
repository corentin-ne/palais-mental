import { useState } from 'react';
import { Linking, Platform, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/Button';
import Icon, { IconName } from '@/components/ui/Icon';
import PressableScale from '@/components/ui/PressableScale';
import { Section } from '@/components/ui/Screen';
import { FadeIn, animateLayout } from '@/components/ui/Motion';
import { makeStyles, noOutline, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { useLayout } from '@/hooks/useLayout';
import { pickFiles } from '@/lib/backup';
import { exportCalendar } from '@/lib/calendarFile';
import {
  HttpError,
  MissingSetup,
  SETUP,
  SyncResult,
  exportBooksCsv,
  exportForAnimeList,
  exportForLetterboxd,
  exportImdbCsv,
  importExportFiles,
  isSetUp,
  syncAll,
  syncService,
  usernameFrom,
} from '@/lib/connect';
import { relativeDay, timeOf } from '@/lib/format';
import { refreshRelated } from '@/lib/related';
import { Service, useConnections } from '@/store/useConnections';
import { useUi } from '@/store/useUi';

const NAMES: Record<Service, string> = {
  letterboxd: 'Letterboxd',
  serializd: 'Serializd',
  trakt: 'Trakt',
  mal: 'MyAnimeList',
  anilist: 'AniList',
  kitsu: 'Kitsu',
  plex: 'Plex',
  jellyfin: 'Jellyfin',
  emby: 'Emby',
  goodreads: 'Goodreads',
  openlibrary: 'Open Library',
  bookwyrm: 'BookWyrm',
  hardcover: 'Hardcover',
  steam: 'Steam',
  retroachievements: 'RetroAchievements',
};

/** Where to create the key or token a service asks for. */
const TOKEN_PAGES: Partial<Record<Service, string>> = {
  trakt: 'https://trakt.tv/oauth/applications/new',
  steam: 'https://steamcommunity.com/dev/apikey',
  retroachievements: 'https://retroachievements.org/settings',
  hardcover: 'https://hardcover.app/account/api',
  plex: 'https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/',
};

const GROUPS: { key: string; icon: IconName; services: Service[] }[] = [
  { key: 'screen', icon: 'movies', services: ['letterboxd', 'serializd', 'trakt'] },
  { key: 'anime', icon: 'series', services: ['mal', 'anilist', 'kitsu'] },
  { key: 'servers', icon: 'window', services: ['plex', 'jellyfin', 'emby'] },
  { key: 'books', icon: 'journal', services: ['goodreads', 'openlibrary', 'bookwyrm', 'hardcover'] },
  { key: 'games', icon: 'play', services: ['steam', 'retroachievements'] },
];

type Exportable = 'letterboxd' | 'mal' | 'anilist' | 'goodreads' | 'bookwyrm' | 'hardcover' | 'trakt';

/**
 * Other trackers, media servers and stores: public profiles, personal keys you create on the
 * service, or your own server, read from the phone. Export files go both ways.
 */
export default function ConnectionsScreen() {
  const { t } = useTranslation();
  const { palette, type } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const { gutter, content } = useLayout();
  const autoSync = useConnections((s) => s.autoSync);
  const connected = useConnections((s) => (Object.keys(s.accounts) as Service[]).filter((k) => isSetUp(k, s.accounts[k])).length);
  const [current, setCurrent] = useState<Service>();
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
    } catch (err) {
      toast(errorText(t, err));
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

  /** Writes a file for another app's import page; `job` returns how many entries it holds. */
  const send = async (id: string, job: () => Promise<number>, done = 'connect.exported') => {
    setBusy(id);
    setProgress(undefined);
    try {
      const count = await job();
      toast(t(done, { count }));
    } catch {
      toast(t('profile.exportFailed'));
    } finally {
      setBusy(undefined);
      setProgress(undefined);
    }
  };

  const exportFor = (service: Exportable) =>
    send(`export-${service}`, () =>
      service === 'letterboxd'
        ? exportForLetterboxd()
        : service === 'mal' || service === 'anilist'
          ? exportForAnimeList(service, (d, n) => setProgress([d, n]))
          : service === 'trakt'
            ? exportImdbCsv()
            : exportBooksCsv(service),
    );
  const exportable = (s: Service): s is Exportable => ['letterboxd', 'mal', 'anilist', 'goodreads', 'bookwyrm', 'hardcover', 'trakt'].includes(s);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8, paddingHorizontal: gutter, width: content }]}>
        <PressableScale onPress={() => router.back()} style={styles.back} accessibilityLabel={t('common.back')}>
          <Icon name="back" size={20} color={palette.ink} strokeWidth={2.2} />
        </PressableScale>
        <Text style={type.hero}>{t('connect.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingHorizontal: gutter, width: content, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>{t('connect.intro')}</Text>
        {Platform.OS === 'web' && <Text style={[styles.intro, { color: palette.danger }]}>{t('connect.web')}</Text>}

        {connected > 1 && (
          <Button
            label={t('connect.syncAll', { count: connected })}
            icon="refresh"
            variant="secondary"
            onPress={() => run('all', () => syncAll((d, n) => setProgress([d, n]), setCurrent).finally(() => setCurrent(undefined)))}
            loading={busy === 'all'}
            disabled={!!busy && busy !== 'all'}
            style={{ marginTop: 10 }}
          />
        )}

        {busy && progress && progress[1] > 0 && (
          <FadeIn style={styles.progress}>
            <Text style={styles.progressText}>
              {busy === 'all' && current ? `${NAMES[current]} · ` : ''}
              {t('connect.progress', { done: progress[0], total: progress[1] })}
            </Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round((progress[0] / progress[1]) * 100)}%` }]} />
            </View>
          </FadeIn>
        )}

        {GROUPS.map((g) => (
          <Section key={g.key} title={t(`connect.group.${g.key}`)} style={{ marginTop: 26, gap: 0 }}>
            {g.services.map((service, i) => (
              <FadeIn key={service} index={i}>
                <ServiceCard
                  service={service}
                  busy={busy}
                  onSync={() => run(service, () => syncService(service, (d, n) => setProgress([d, n])))}
                  onExport={exportable(service) ? () => exportFor(service) : undefined}
                />
              </FadeIn>
            ))}
          </Section>
        ))}

        <View style={[styles.card, styles.row, { marginTop: 26 }]}>
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

        <Section title={t('connect.send')}>
          <View style={styles.card}>
            <Text style={styles.hint}>{t('connect.sendHint')}</Text>
            <SendRow icon="journal" title={t('connect.sendBooks')} hint={t('connect.sendBooksHint')} busy={busy} id="send-books" onPress={() => send('send-books', () => exportBooksCsv('goodreads'))} />
            <SendRow icon="movies" title={t('connect.sendImdb')} hint={t('connect.sendImdbHint')} busy={busy} id="send-imdb" onPress={() => send('send-imdb', exportImdbCsv)} />
            <SendRow icon="movies" title={t('connect.sendLetterboxd')} hint={t('connect.exportLetterboxd')} busy={busy} id="send-lb" onPress={() => send('send-lb', exportForLetterboxd)} />
            <SendRow icon="calendar" title={t('connect.sendCalendar')} hint={t('connect.sendCalendarHint')} busy={busy} id="send-ics" onPress={() => send('send-ics', exportCalendar, 'connect.exportedEvents')} />
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

function errorText(t: (k: string) => string, err: unknown) {
  if (err instanceof MissingSetup) return t(`connect.missing.${err.what}`);
  if (err instanceof HttpError) return t(err.status === 404 ? 'connect.notFound' : err.status === 401 || err.status === 403 ? 'connect.denied' : 'connect.failed');
  return t('connect.offline');
}

function SendRow({ icon, title, hint, id, busy, onPress }: { icon: IconName; title: string; hint: string; id: string; busy?: string; onPress: () => void }) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.row, { alignItems: 'flex-start' }]}>
      <Icon name={icon} size={20} color={palette.inkSoft} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.label}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Button label={t('connect.exportFile')} icon="download" variant="secondary" compact onPress={onPress} loading={busy === id} disabled={!!busy && busy !== id} />
    </View>
  );
}

function ServiceCard({ service, busy, onSync, onExport }: { service: Service; busy?: string; onSync: () => void; onExport?: () => void }) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const account = useConnections((s) => s.accounts[service]);
  const need = SETUP[service];
  const ready = isSetUp(service, account);
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState('');
  const [token, setToken] = useState('');
  const [server, setServer] = useState('');
  const canConnect = (!need.username || !!user.trim()) && (need.token !== 'required' || !!token.trim()) && (!need.server || !!server.trim());
  const connect = () => {
    if (!canConnect) return;
    useConnections.getState().setAccount(service, {
      username: user.trim() ? usernameFrom(service, user) : '',
      token: token.trim() || undefined,
      server: server.trim() || undefined,
      lastError: false,
    });
    setUser('');
    setToken('');
    setServer('');
    setTimeout(onSync, 0);
  };
  const shown = account?.username ? (service === 'goodreads' ? `#${account.username}` : `@${account.username}`) : account?.server?.replace(/^https?:\/\//, '');

  return (
    <View style={styles.card}>
      <PressableScale
        depth={0.99}
        onPress={() => {
          animateLayout();
          setOpen((o) => !o);
        }}
        style={styles.row}
        accessibilityLabel={NAMES[service]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{NAMES[service]}</Text>
          <Text style={styles.hint} numberOfLines={open ? undefined : 1}>
            {t(`connect.hint.${service}`)}
          </Text>
        </View>
        {ready ? (
          <View style={[styles.pill, account!.lastError && { backgroundColor: palette.dangerTint }]}>
            <Text style={[styles.pillText, account!.lastError && { color: palette.danger }]} numberOfLines={1}>
              {account!.lastError ? t('connect.error') : (shown ?? t('connect.connected'))}
            </Text>
          </View>
        ) : (
          <Icon name="chevronRight" size={16} color={palette.inkFaint} />
        )}
      </PressableScale>

      {ready && account ? (
        <>
          {account.lastError && (
            <Text style={[styles.hint, { color: palette.danger }]}>
              {t(account.lastErrorStatus === 404 ? 'connect.notFound' : account.lastErrorStatus === 401 || account.lastErrorStatus === 403 ? 'connect.denied' : account.lastErrorStatus ? 'connect.failed' : 'connect.offline')}
            </Text>
          )}
          {!!account.lastSync && (
            <Text style={styles.hint}>{t('connect.lastSync', { when: `${relativeDay(account.lastSync)} ${timeOf(account.lastSync)}`, changes: account.lastChanges ?? 0 })}</Text>
          )}
          <View style={styles.buttons}>
            <Button label={t('connect.sync')} icon="refresh" compact onPress={onSync} loading={busy === service} disabled={!!busy && busy !== service} />
            {onExport && (
              <Button label={t('connect.export')} icon="download" variant="secondary" compact onPress={onExport} loading={busy === `export-${service}`} disabled={!!busy && busy !== `export-${service}`} />
            )}
            <Button label={t('connect.disconnect')} variant="ghost" compact onPress={() => useConnections.getState().setAccount(service, null)} disabled={!!busy} />
          </View>
          {open && <Text style={styles.footnote}>{t(`connect.note.${service}`)}</Text>}
        </>
      ) : (
        open && (
          <View style={{ gap: 8 }}>
            {need.server && (
              <TextInput
                value={server}
                onChangeText={setServer}
                placeholder={t(`connect.serverPlaceholder.${service}`)}
                placeholderTextColor={palette.inkFaint}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={[styles.input, noOutline]}
              />
            )}
            {(need.username || need.server) && (
              <TextInput
                value={user}
                onChangeText={setUser}
                placeholder={t(need.username ? `connect.userPlaceholder.${service}` : 'connect.serverUser')}
                placeholderTextColor={palette.inkFaint}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, noOutline]}
                onSubmitEditing={connect}
              />
            )}
            {need.token && (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput
                  value={token}
                  onChangeText={setToken}
                  placeholder={t(`connect.tokenPlaceholder.${service}`)}
                  placeholderTextColor={palette.inkFaint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  style={[styles.input, styles.grow, noOutline]}
                  onSubmitEditing={connect}
                />
                {TOKEN_PAGES[service] && <Button label={t('connect.getToken')} icon="link" variant="secondary" compact onPress={() => Linking.openURL(TOKEN_PAGES[service]!).catch(() => undefined)} />}
              </View>
            )}
            <Text style={styles.footnote}>{t(`connect.note.${service}`)}</Text>
            <Button label={t('connect.connect')} compact onPress={connect} disabled={!canConnect || !!busy} />
          </View>
        )
      )}
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  root: { flex: 1, backgroundColor: palette.screen, alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 8 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  intro: { ...type.small, fontSize: 13.5, lineHeight: 19, marginTop: 6, marginBottom: 6 },
  card: { marginTop: 10, padding: 16, gap: 12, borderRadius: radii.lg, backgroundColor: palette.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  label: { fontFamily: fonts.medium, fontSize: 15, color: palette.ink },
  hint: { ...type.small, fontSize: 12.5, lineHeight: 17 },
  footnote: { ...type.small, fontSize: 11.5, lineHeight: 16, color: palette.inkFaint },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  /** Next to a button on its row. */
  grow: { flex: 1 },
  input: { alignSelf: 'stretch', height: 40, borderRadius: 12, paddingHorizontal: 12, backgroundColor: palette.field, fontFamily: fonts.body, fontSize: 14, color: palette.ink },
  pill: { maxWidth: 150, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: palette.successTint },
  pillText: { fontFamily: fonts.semibold, fontSize: 11, color: palette.success },
  progress: { marginTop: 12, padding: 14, gap: 8, borderRadius: radii.lg, backgroundColor: palette.primaryTint },
  progressText: { fontFamily: fonts.medium, fontSize: 13, color: palette.primary },
  track: { height: 4, borderRadius: 2, backgroundColor: palette.surface, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: palette.primary },
  unmatched: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: palette.inkSoft },
}));
