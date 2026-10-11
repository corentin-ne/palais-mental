import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/Button';
import Segmented from '@/components/ui/Segmented';
import { ActionRow, Block, Group, Header, useStyles } from '@/components/ui/SettingsList';
import { useHaptics } from '@/hooks/useHaptics';
import { useLayout } from '@/hooks/useLayout';
import { ExportKind, Snapshot, autoSnapshot, exportData, listSnapshots, pickBackup, restoreSnapshot } from '@/lib/backup';
import { fullDate } from '@/lib/format';
import { refreshLibrary } from '@/lib/sync';
import { useLibrary } from '@/store/useLibrary';
import { useUi } from '@/store/useUi';
import { Aurora } from '@/spark';

type CsvKind = Extract<ExportKind, 'shows-csv' | 'movies-csv' | 'books-csv' | 'games-csv'>;

/** Everything that brings data in or takes it out: connected services, backups, CSV sheets and automatic copies. */
export default function DataScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const { gutter, content } = useLayout();
  const toast = useUi((s) => s.showToast);
  const [csv, setCsv] = useState<CsvKind>('shows-csv');

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

  return (
    <View style={styles.root}>
      <Aurora />
      <Header title={t('profile.data')} top={insets.top} gutter={gutter} width={content} onBack={() => router.back()} backLabel={t('common.back')} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 48, paddingHorizontal: gutter, width: content, alignSelf: 'center' }}>
        <Group index={0} title={t('connect.title')}>
          <ActionRow icon="link" tint="#14A3B8" label={t('connect.title')} hint={t('connect.rowHint')} onPress={() => router.push('/connections')} last />
        </Group>

        <Group index={1} title={t('data.backup')}>
          <ActionRow icon="download" tint="#0B63CE" label={t('profile.exportJson')} hint={t('profile.exportJsonHint')} onPress={() => onExport('json')} />
          <ActionRow icon="upload" tint="#0B63CE" label={t('profile.import')} hint={t('profile.importHint')} onPress={onImport} last />
        </Group>

        <Group index={2} title={t('settings.csv')}>
          <Block icon="grid" tint="#5B6B7F" label={t('data.csvLabel')} last>
            <Segmented<CsvKind>
              value={csv}
              onChange={setCsv}
              options={[
                { value: 'shows-csv', label: t('common.shows') },
                { value: 'movies-csv', label: t('common.movies') },
                { value: 'books-csv', label: t('common.books') },
                { value: 'games-csv', label: t('common.games') },
              ]}
            />
            <Button label={t('data.csvExport')} icon="download" compact onPress={() => onExport(csv)} />
          </Block>
        </Group>

        <Snapshots />
      </ScrollView>
    </View>
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
      <Group index={3} title={t('settings.snapshots')}>
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
