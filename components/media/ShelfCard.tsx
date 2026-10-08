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
    // The card opens the title and the + moves you on: siblings, not one button inside another.
    <View style={[styles.card, { width }]}>
      <PressableScale depth={0.98} onPress={() => router.push(`/${kind}/${item.id}` as never)} style={styles.open} accessibilityLabel={item.title}>
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
      </PressableScale>
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
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii }) => ({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radii.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  info: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...fonts.semibold, fontSize: 15.5, lineHeight: 20, color: palette.ink, letterSpacing: -0.2 },
  sub: { ...fonts.body, fontSize: 13.5, lineHeight: 18, color: palette.inkSoft },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: palette.fieldActive, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: palette.primary },
  where: { ...fonts.medium, fontSize: 12, color: palette.inkFaint, maxWidth: '60%', fontVariant: ['tabular-nums'] },
  plus: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary },
}));
