import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import JournalCard, { useJournal } from '@/components/media/JournalCard';
import Chips from '@/components/ui/Chips';
import Empty from '@/components/ui/Empty';
import { FadeIn } from '@/components/ui/Motion';
import { Header, useStyles } from '@/components/ui/SettingsList';
import { useLayout } from '@/hooks/useLayout';
import type { JournalEntry } from '@/lib/journal';
import { Aurora } from '@/spark';

type Filter = 'all' | 'episodes' | 'show' | 'movie' | 'book' | 'game';
const FILTERS: Filter[] = ['all', 'episodes', 'show', 'movie', 'book', 'game'];
const matches = (f: Filter, e: JournalEntry) => f === 'all' || (f === 'episodes' ? e.episode : !e.episode && e.kind === f);

/** Every note you kept, by kind: episodes, series, films, books and games. */
export default function JournalScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { gutter, content } = useLayout();
  const all = useJournal();
  const [filter, setFilter] = useState<Filter>('all');
  const list = all.filter((e) => matches(filter, e));

  return (
    <View style={styles.root}>
      <Aurora />
      <Header title={t('journal.title')} top={insets.top} gutter={gutter} width={content} onBack={() => router.back()} backLabel={t('common.back')} />
      <FlatList
        data={list}
        keyExtractor={(e) => e.key}
        style={{ width: content }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingHorizontal: gutter, gap: 8 }}
        ListHeaderComponent={
          <View style={{ marginTop: 10, marginBottom: 6 }}>
            <Chips<Filter>
              inset={gutter}
              value={filter}
              onChange={setFilter}
              options={FILTERS.filter((f) => f === 'all' || all.some((e) => matches(f, e))).map((f) => ({
                value: f,
                label: t(`journal.filter.${f}`),
                count: all.filter((e) => matches(f, e)).length,
              }))}
            />
          </View>
        }
        ListEmptyComponent={<Empty icon="journal" title={t('journal.title')} body={t('journal.empty')} />}
        renderItem={({ item, index }) => (
          <FadeIn index={Math.min(index, 12)} distance={8}>
            <JournalCard entry={item} />
          </FadeIn>
        )}
      />
    </View>
  );
}
