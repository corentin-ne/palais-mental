import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import Poster from '@/components/ui/Poster';
import PressableScale from '@/components/ui/PressableScale';
import { StarBadge } from '@/components/ui/StarRating';
import { makeStyles } from '@/constants/theme';
import { JournalEntry, journalEntries } from '@/lib/journal';
import { useLibrary } from '@/store/useLibrary';

/** Every note you kept, latest first. */
export function useJournal() {
  const { t } = useTranslation();
  const shows = useLibrary((s) => s.shows);
  const movies = useLibrary((s) => s.movies);
  const books = useLibrary((s) => s.books);
  const games = useLibrary((s) => s.games);
  return useMemo(() => journalEntries({ shows, movies, books, games }, t), [shows, movies, books, games, t]);
}

/** One note: the poster, the title, your stars and your words. No date: the journal is not a timeline. */
export default function JournalCard({ entry: e }: { entry: JournalEntry }) {
  const styles = useStyles();
  const router = useRouter();
  return (
    <PressableScale depth={0.98} style={styles.entry} onPress={() => router.push(e.href as never)}>
      <Poster uri={e.poster} title={e.title} width={44} kind={e.kind} elevated={false} radius={6} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.entryHead}>
          <Text style={styles.entryTitle} numberOfLines={1}>
            {e.title}
          </Text>
          {e.rating != null && <StarBadge value={e.rating} />}
        </View>
        <Text style={styles.entryDetail} numberOfLines={1}>
          {e.detail}
        </Text>
        {!!e.text && (
          <Text style={styles.entryText} numberOfLines={3}>
            {e.text}
          </Text>
        )}
      </View>
    </PressableScale>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii }) => ({
  entry: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 10, borderRadius: radii.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  entryHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryTitle: { flex: 1, ...fonts.semibold, fontSize: 14.5, color: palette.ink },
  entryDetail: { ...fonts.body, fontSize: 12.5, color: palette.inkSoft },
  entryText: { ...fonts.displayItalic, fontSize: 16, lineHeight: 21, color: palette.ink, marginTop: 2 },
}));
