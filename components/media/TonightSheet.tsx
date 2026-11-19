import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { Href, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Poster from '@/components/ui/Poster';
import PressableScale from '@/components/ui/PressableScale';
import Sheet from '@/components/ui/Sheet';
import { Fan } from '@/components/ui/Empty';
import { makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { runtime } from '@/lib/format';
import { Idea, ideasFor } from '@/lib/tonight';
import { Chip, ChipRow } from '@/spark';
import { useLibrary } from '@/store/useLibrary';

const BUDGETS = [30, 60, 90, 120, Infinity];
/** How many of the best ideas the draw runs through. */
const DRAW = 8;

/**
 * "Tonight I have…": pick the time you have, the sheet lists what fits (the show you're in, a film of the
 * right length, a book you can finish) and a draw spins through the posters to land on one.
 */
export default function TonightSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const router = useRouter();
  const haptics = useHaptics();
  const shows = useLibrary((s) => s.shows);
  const movies = useLibrary((s) => s.movies);
  const books = useLibrary((s) => s.books);
  const games = useLibrary((s) => s.games);
  const [budget, setBudget] = useState(60);
  const [seed, setSeed] = useState(0);
  const ideas = useMemo(() => (visible ? ideasFor({ shows, movies, books, games }, budget) : []), [visible, shows, movies, books, games, budget, seed]);
  const [picked, setPicked] = useState<Idea>();
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    if (!visible) setPicked(undefined);
  }, [visible]);
  useEffect(() => setPicked(undefined), [budget]);

  const open = (idea: Idea) => {
    onClose();
    router.push(idea.href as Href);
  };

  const label = (b: number) => (Number.isFinite(b) ? runtime(b)! : t('tonight.allEvening'));
  const pool = ideas.slice(0, DRAW);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('tonight.title')}
      subtitle={t('tonight.subtitle')}
      footer={
        pool.length > 0 ? (
          picked && !spinning ? (
            <View style={styles.row}>
              <Button label={t('tonight.go')} icon="play" onPress={() => open(picked)} style={{ flex: 1 }} />
              <Button
                label={t('tonight.again')}
                icon="refresh"
                variant="secondary"
                iconOnly
                onPress={() => {
                  setPicked(undefined);
                  setSpinning(true);
                  setSeed((s) => s + 1);
                }}
              />
            </View>
          ) : (
            <Button label={t('tonight.draw')} icon="sparkle" onPress={() => setSpinning(true)} disabled={spinning} />
          )
        ) : undefined
      }
    >
      <ChipRow inset={20}>
        {BUDGETS.map((b) => (
          <Chip
            key={b}
            label={label(b)}
            active={b === budget}
            onPress={() => {
              haptics.select();
              setBudget(b);
            }}
          />
        ))}
      </ChipRow>

      {pool.length === 0 ? (
        <View style={styles.empty}>
          <Fan icon="clock" size={48} />
          <Text style={styles.emptyText}>{t('tonight.none')}</Text>
        </View>
      ) : spinning || picked ? (
        <Draw
          key={`${budget}:${seed}`}
          pool={pool}
          onLanded={(idea) => {
            setPicked(idea);
            setSpinning(false);
            haptics.success();
          }}
          onTick={haptics.select}
          picked={picked}
          onOpen={open}
        />
      ) : (
        <View style={{ gap: 8 }}>
          {ideas.slice(0, 6).map((idea) => (
            <IdeaRow key={idea.key} idea={idea} onPress={() => open(idea)} />
          ))}
        </View>
      )}
    </Sheet>
  );
}

/** The draw: posters flick by fast, then slower, and settle on one with a spring. */
function Draw({ pool, onLanded, onTick, picked, onOpen }: { pool: Idea[]; onLanded: (i: Idea) => void; onTick: () => void; picked?: Idea; onOpen: (i: Idea) => void }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const { spark } = useTheme();
  const [shown, setShown] = useState(picked ?? pool[0]);
  const pop = useRef(new Animated.Value(picked ? 1 : 0)).current;

  useEffect(() => {
    if (picked) return;
    // Weighted: better ideas come up more often, any of them can win.
    const total = pool.reduce((n, _, i) => n + (pool.length - i), 0);
    let r = Math.random() * total;
    const winner = pool.find((_, i) => (r -= pool.length - i) < 0) ?? pool[0];
    const steps = spark.reduceMotion ? 0 : 14;
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (i >= steps) {
        setShown(winner);
        Animated.spring(pop, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 240 }).start();
        onLanded(winner);
        return;
      }
      setShown(pool[(i + Math.floor(Math.random() * pool.length)) % pool.length]);
      onTick();
      i++;
      // Slowing down like a wheel: 50 ms between the first flicks, 260 by the last.
      timer = setTimeout(step, 50 + Math.pow(i / steps, 2.2) * 210);
    };
    step();
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.draw}>
      <Animated.View style={{ transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }}>
        <PressableScale onPress={() => picked && onOpen(picked)} disabled={!picked} accessibilityLabel={shown.title}>
          <Poster uri={shown.poster} title={shown.title} width={132} kind={shown.kind} />
        </PressableScale>
      </Animated.View>
      <Animated.View style={{ alignItems: 'center', gap: 2, opacity: pop }}>
        <Text style={styles.drawTitle} numberOfLines={2}>
          {shown.title}
        </Text>
        <Text style={styles.drawWhat}>{whatOf(t, shown)}</Text>
      </Animated.View>
    </View>
  );
}

function IdeaRow({ idea, onPress }: { idea: Idea; onPress: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const { palette } = useTheme();
  return (
    <PressableScale depth={0.98} onPress={onPress} style={styles.idea} accessibilityLabel={`${idea.title}, ${whatOf(t, idea)}`}>
      <Poster uri={idea.poster} title={idea.title} width={40} kind={idea.kind} elevated={false} radius={6} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={styles.ideaTitle} numberOfLines={1}>
          {idea.title}
        </Text>
        <Text style={styles.ideaWhat} numberOfLines={1}>
          {whatOf(t, idea)}
        </Text>
      </View>
      <Icon name="chevronRight" size={16} color={palette.inkFaint} strokeWidth={2.2} />
    </PressableScale>
  );
}

/** What to do, in words; a film's length as "1h 52". */
const whatOf = (t: (k: string, o?: Record<string, unknown>) => string, idea: Idea) =>
  t(idea.what.key, idea.what.params?.time != null ? { ...idea.what.params, time: runtime(Number(idea.what.params.time)) } : idea.what.params);

/** The button that opens the sheet, for a section header. */
export function TonightLink({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const { palette, spark } = useTheme();
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!spark.motion.loops) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glow, spark.motion.loops]);
  return (
    <PressableScale onPress={onPress} style={styles.link} accessibilityLabel={t('tonight.title')}>
      <Animated.View style={{ transform: [{ rotate: glow.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '8deg'] }) }] }}>
        <Icon name="sparkle" size={15} color={palette.primaryText} strokeWidth={2.2} />
      </Animated.View>
      <Text style={styles.linkText}>{t('tonight.link')}</Text>
    </PressableScale>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  row: { flexDirection: 'row', gap: 10 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  emptyText: { ...type.small, textAlign: 'center' },
  draw: { alignItems: 'center', gap: 14, paddingVertical: 10 },
  drawTitle: { ...type.title, textAlign: 'center' },
  drawWhat: { ...fonts.semibold, fontSize: 14, color: palette.primaryText },
  idea: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radii.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  ideaTitle: { ...fonts.semibold, fontSize: 15, color: palette.ink },
  ideaWhat: { ...fonts.medium, fontSize: 12.5, color: palette.inkSoft },
  link: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  linkText: { ...fonts.semibold, fontSize: 14, color: palette.primaryText },
}));
