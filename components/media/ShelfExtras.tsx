import { memo } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';

import { CastRail } from './DetailLayout';
import PosterRail from './PosterRail';
import Button from '@/components/ui/Button';
import PressableScale from '@/components/ui/PressableScale';
import { FadeIn } from '@/components/ui/Motion';
import { makeStyles, useTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { ExtraLink, ExtraRail, Score, ShelfExtras, dropSeen } from '@/lib/extras';

const open = (url: string) => Linking.openURL(url).catch(() => undefined);

/** The source page first, then everything else that has a page about it. */
export const ExtraLinks = memo(function ExtraLinks({ links, onShare }: { links: ExtraLink[]; onShare?: () => void }) {
  const { t } = useTranslation();
  const { gutter } = useLayout();
  if (!links.length && !onShare) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter, marginTop: 18, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: gutter, gap: 8 }}>
      {onShare && <Button label={t('detail.share')} icon="upload" variant="secondary" compact onPress={onShare} />}
      {links.map((l) => (
        <Button key={l.label} label={l.label} icon={l.icon ?? 'globe'} variant="secondary" compact onPress={() => open(l.url)} />
      ))}
    </ScrollView>
  );
});

/** Ratings, reviews, readers, prices: one tile each, tappable when they have a page. */
export const ExtraScores = memo(function ExtraScores({ scores }: { scores: Score[] }) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const { gutter } = useLayout();
  if (!scores.length) return null;
  const tone = (s: Score) => (s.tone === 'good' ? palette.success : s.tone === 'bad' ? palette.danger : palette.ink);
  return (
    <FadeIn style={{ marginTop: 18 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: gutter, gap: 10 }}>
        {scores.map((s) => (
          <PressableScale key={s.key} disabled={!s.url} depth={0.97} onPress={() => s.url && open(s.url)} style={styles.score} accessibilityLabel={`${s.value} ${t(`extras.score.${s.key}`, s.params)}`}>
            <Text style={[styles.scoreValue, { color: tone(s) }]} numberOfLines={1}>
              {s.value}
            </Text>
            <Text style={styles.scoreLabel} numberOfLines={2}>
              {t(`extras.score.${s.key}`, s.params)}
            </Text>
          </PressableScale>
        ))}
      </ScrollView>
    </FadeIn>
  );
});

/** Authors, facts, chips and screenshots: the part of the page you read rather than tap. */
export const ExtraDetails = memo(function ExtraDetails({ extras, kind }: { extras: ShelfExtras; kind: 'book' | 'game' }) {
  const { t } = useTranslation();
  const { type } = useTheme();
  const styles = useStyles();
  const { gutter, wide } = useLayout();
  const facts = extras.facts ?? [];
  const shotW = wide ? 320 : 240;
  return (
    <>
      {!!extras.people?.length && <CastRail cast={extras.people.map((p) => ({ name: p.name, character: p.role, image: p.image }))} title={t(extras.people.length > 1 ? 'extras.authors' : 'extras.author')} />}

      {!!extras.screenshots?.length && (
        <View style={{ marginTop: 30, gap: 14 }}>
          <Text style={type.title}>{t('extras.screenshots')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ paddingHorizontal: gutter, gap: 10 }}>
            {extras.screenshots.map((s, i) => (
              <PressableScale key={s.thumb} depth={0.98} onPress={() => open(s.full)} accessibilityLabel={`${t('extras.screenshots')} ${i + 1}`}>
                <View style={[styles.shot, { width: shotW, height: Math.round((shotW * 9) / 16) }]}>
                  <Image source={{ uri: s.thumb }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} recyclingKey={s.thumb} />
                </View>
              </PressableScale>
            ))}
          </ScrollView>
        </View>
      )}

      {facts.length > 0 && (
        <FadeIn style={{ marginTop: 30, gap: 14 }}>
          <Text style={type.title}>{t(kind === 'book' ? 'extras.aboutBook' : 'extras.aboutGame')}</Text>
          <View style={styles.card}>
            {facts.map((f, i) => (
              <View key={f.key} style={[styles.fact, i > 0 && styles.factEdge]}>
                <Text style={styles.factLabel}>{t(`extras.fact.${f.key}`)}</Text>
                <Text style={styles.factValue} numberOfLines={3}>
                  {f.value}
                </Text>
              </View>
            ))}
          </View>
        </FadeIn>
      )}

      {(extras.tags ?? []).map((g) => (
        <View key={g.key} style={{ marginTop: 26, gap: 12 }}>
          <Text style={type.title}>{t(`extras.tags.${g.key}`)}</Text>
          <View style={styles.chips}>
            {g.items.map((item) => (
              <View key={item} style={styles.chip}>
                <Text style={styles.chipText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </>
  );
});

/**
 * More by the author, developer or publisher, adaptations, sources, books alike. A title shows
 * once on the page: in the series rail, else in the first rail that has it.
 */
export const ExtraRails = memo(function ExtraRails({ rails, exclude }: { rails: ExtraRail[]; exclude: string[] }) {
  const { t } = useTranslation();
  const { type } = useTheme();
  const seen = new Set(exclude);
  return (
    <>
      {rails.map((r) => {
        const items = dropSeen(r.items, seen);
        for (const i of items) seen.add(i.href);
        if (items.length < (r.key === 'adaptations' || r.key === 'basedOn' ? 1 : 2)) return null;
        return (
          <View key={r.key} style={{ marginTop: 30, gap: 14 }}>
            <Text style={type.title} numberOfLines={2}>
              {t(`extras.rail.${r.title}`, r.params)}
            </Text>
            <PosterRail items={items} />
          </View>
        );
      })}
    </>
  );
});

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  score: { minWidth: 104, maxWidth: 160, paddingHorizontal: 14, paddingVertical: 12, gap: 3, borderRadius: radii.md, backgroundColor: palette.surface },
  scoreValue: { fontFamily: fonts.semibold, fontSize: 19, color: palette.ink },
  scoreLabel: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: palette.inkSoft },
  card: { borderRadius: radii.lg, backgroundColor: palette.surface, paddingHorizontal: 16, paddingVertical: 4 },
  fact: { flexDirection: 'row', gap: 14, paddingVertical: 11, alignItems: 'flex-start' },
  factEdge: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.hairline },
  factLabel: { ...type.label, width: 116, paddingTop: 2 },
  factValue: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: palette.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: palette.surface },
  chipText: { fontFamily: fonts.medium, fontSize: 12.5, color: palette.inkSoft },
  shot: { borderRadius: radii.md, overflow: 'hidden', backgroundColor: palette.placeholder },
}));
