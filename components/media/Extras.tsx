import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';

import PosterRail from './PosterRail';
import Button from '@/components/ui/Button';
import { FadeIn } from '@/components/ui/Motion';
import { makeStyles } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { shareTitle } from '@/lib/share';
import { Extras as ExtrasData, Provider, imdbPage, justWatchSearch, youtubeSearch, youtubeWatch } from '@/lib/api';

interface Props {
  kind: 'show' | 'movie';
  title: string;
  year?: number;
  imdbId?: string;
  extras?: ExtrasData;
}

/** Trailer, where to watch, and more like this. Works without a key through search links. */
export default function Extras({ kind, title, year, imdbId, extras }: Props) {
  const { t, i18n } = useTranslation();
  const styles = useStyles();
  const { gutter } = useLayout();
  const p = extras?.providers;
  const groups = p ? ([['stream', p.stream], ['rent', p.rent], ['buy', p.buy]] as const).filter(([, list]) => list.length) : [];
  const open = (url: string) => Linking.openURL(url).catch(() => undefined);

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter, marginTop: 18, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: gutter, gap: 8 }}>
        <Button
          label={t('extras.trailer')}
          icon="play"
          variant="secondary"
          compact
          onPress={() => open(extras?.trailerKey ? youtubeWatch(extras.trailerKey) : youtubeSearch(title, year))}
        />
        <Button label={t('extras.whereToWatch')} icon="eye" variant="secondary" compact onPress={() => open(p?.link ?? justWatchSearch(title, i18n.language))} />
        {!!imdbId && <Button label="IMDb" icon="globe" variant="secondary" compact onPress={() => open(imdbPage(imdbId))} />}
        <Button label={t('detail.share')} icon="upload" variant="secondary" compact onPress={() => shareTitle(title, year, imdbId ? imdbPage(imdbId) : undefined)} />
      </ScrollView>

      {groups.length > 0 && (
        <FadeIn style={{ marginTop: 30, gap: 14 }}>
          <Text style={styles.title}>{t('extras.whereToWatch')}</Text>
          <View style={styles.card}>
            {groups.map(([group, list]) => (
              <View key={group} style={styles.group}>
                <Text style={styles.groupLabel}>{t(`extras.${group}`)}</Text>
                <View style={styles.logos}>
                  {list.map((prov: Provider) => (
                    <View key={prov.name} style={styles.provider} accessibilityLabel={prov.name}>
                      {prov.logo ? <Image source={{ uri: prov.logo }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={styles.provName}>{prov.name.slice(0, 2)}</Text>}
                    </View>
                  ))}
                </View>
              </View>
            ))}
            <Text style={styles.credit}>{t('extras.justwatch')}</Text>
          </View>
        </FadeIn>
      )}

    </>
  );
}

/** More like this: opens in the app (shows by name through TVmaze). */
export function Similar({ kind, extras }: { kind: 'show' | 'movie'; extras?: ExtrasData }) {
  const { t } = useTranslation();
  const styles = useStyles();
  if (!extras?.similar.length) return null;
  return (
    <View style={{ marginTop: 30, gap: 14 }}>
      <Text style={styles.title}>{t('extras.similar')}</Text>
      <PosterRail
        items={extras.similar.map((s) => ({
          key: s.id,
          href: kind === 'show' ? `/show/${encodeURIComponent(s.id)}` : `/movie/${s.id}`,
          title: s.title,
          poster: s.poster,
          kind,
          caption: s.year ? String(s.year) : undefined,
        }))}
      />
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  title: { ...type.title },
  card: { borderRadius: radii.lg, backgroundColor: palette.surface, padding: 16, gap: 14 },
  group: { gap: 8 },
  groupLabel: { ...type.label },
  logos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  provider: { width: 46, height: 46, borderRadius: 12, overflow: 'hidden', backgroundColor: palette.field, alignItems: 'center', justifyContent: 'center' },
  provName: { fontFamily: fonts.semibold, fontSize: 13, color: palette.inkSoft },
  credit: { ...type.small, fontSize: 11 },
}));
