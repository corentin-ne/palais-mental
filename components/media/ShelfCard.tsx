import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import Icon from '@/components/ui/Icon';
import Poster from '@/components/ui/Poster';
import PressableScale from '@/components/ui/PressableScale';
import { makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { bookFraction, gameFraction } from '@/lib/shelf';
import { Book, Game } from '@/lib/types';
import { useLibrary } from '@/store/useLibrary';

type Props = { width: number } & ({ kind: 'book'; item: Book } | { kind: 'game'; item: Game });

/**
 * A book you are reading or a game you are playing: where you are, and a + to move on
 * (a page, or ten on a long press; an hour of play). The exact value is set on its page.
 */
export default function ShelfCard({ kind, item, width }: Props) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const haptics = useHaptics();
  const book = kind === 'book' ? item : undefined;
  const game = kind === 'game' ? item : undefined;
  const fraction = book ? bookFraction(book) : gameFraction(game!);
  const sub = book ? book.authors.slice(0, 2).join(', ') : game!.developer;
  const where = book
    ? book.page
      ? book.pages
        ? t('book.pageOf', { page: book.page, count: book.pages })
        : t('book.pageN', { page: book.page })
      : t('book.notStartedPage')
    : [game!.hours ? t('game.hoursN', { count: game!.hours }) : undefined, game!.percent ? `${game!.percent} %` : undefined].filter(Boolean).join(' · ') || t('game.justStarted');

  const bump = (by: number) => {
    haptics.select();
    const lib = useLibrary.getState();
    if (book) lib.setBookPage(book.id, Math.min(book.pages || Infinity, (book.page ?? 0) + by));
    else lib.setGameProgress(game!.id, { hours: (game!.hours ?? 0) + by });
  };
  const atEnd = !!book?.pages && (book.page ?? 0) >= book.pages;

  return (
    <PressableScale depth={0.98} onPress={() => router.push(`/${kind}/${item.id}` as never)} style={[styles.card, { width }]} accessibilityLabel={item.title}>
      <Poster uri={item.cover} title={item.title} width={52} kind={kind} elevated={false} radius={7} />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        {!!sub && (
          <Text style={styles.sub} numberOfLines={1}>
            {sub}
          </Text>
        )}
        <View style={styles.metaRow}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(fraction * 100)}%` }]} />
          </View>
          <Text style={styles.where} numberOfLines={1}>
            {where}
          </Text>
        </View>
      </View>
      <PressableScale
        onPress={() => bump(1)}
        onLongPress={book ? () => bump(10) : undefined}
        disabled={atEnd}
        depth={0.85}
        hitSlop={6}
        accessibilityLabel={t(book ? 'book.nextPage' : 'game.addHour')}
        style={styles.plus}
      >
        <Icon name="plus" size={18} color={palette.onInk} strokeWidth={2.4} />
      </PressableScale>
    </PressableScale>
  );
}

const useStyles = makeStyles(({ palette, fonts, shadow, radii }) => ({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 10, paddingRight: 12, borderRadius: radii.lg, backgroundColor: palette.surface, ...shadow.soft, shadowOpacity: 0.06 },
  info: { flex: 1, gap: 3 },
  title: { fontFamily: fonts.semibold, fontSize: 15.5, color: palette.ink, letterSpacing: -0.2 },
  sub: { fontFamily: fonts.body, fontSize: 13, color: palette.inkSoft },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: palette.field, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: palette.primary },
  where: { fontFamily: fonts.medium, fontSize: 11.5, color: palette.inkFaint, maxWidth: '60%' },
  plus: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary },
}));
