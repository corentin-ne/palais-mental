import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import NameField from '@/components/friends/NameField';
import Button from '@/components/ui/Button';
import Chips from '@/components/ui/Chips';
import Icon from '@/components/ui/Icon';
import Poster from '@/components/ui/Poster';
import PressableScale from '@/components/ui/PressableScale';
import Screen from '@/components/ui/Screen';
import Segmented from '@/components/ui/Segmented';
import { StarBadge } from '@/components/ui/StarRating';
import { FadeIn } from '@/components/ui/Motion';
import { makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { useLayout } from '@/hooks/useLayout';
import { leaveFriends, setShareRatings, syncFriends } from '@/lib/friends';
import { bandOf, quorumFor, starsText, useDigest, useLocalHrefs } from '@/lib/ribbons';
import type { MediaKind } from '@/lib/types';
import { Switch } from '@/spark';
import { BAND_COLORS, useFriends } from '@/store/useFriends';
import { useUi } from '@/store/useUi';

type Tab = 'recos' | 'ratings' | 'people';
type RecoFilter = 'all' | 'forMe' | 'mine';
type KindFilter = 'all' | MediaKind;
const KIND_LABEL = { show: 'common.shows', movie: 'common.movies', book: 'common.books', game: 'common.games' } as const;
const LIST = 60;

/**
 * Social, in one place: every recommendation, what the group rated, and who is there. All of it is read
 * from what the phone last synced, so it opens the same offline; choosing a name is all it takes to be in.
 */
export default function SocialScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const me = useFriends((s) => s.me);
  const [tab, setTab] = useState<Tab>('recos');
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    syncFriends(true);
  }, []);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncFriends(true);
    setRefreshing(false);
  }, []);

  // No name yet: choosing one comes first, everything else appears once you are in.
  return (
    <Screen title={t('friends.title')} refreshing={refreshing} onRefresh={me ? onRefresh : undefined}>
        {me ? (
          <>
            <View style={{ marginTop: 12 }}>
              <Segmented<Tab>
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'recos', label: t('friends.tab.recos') },
                  { value: 'ratings', label: t('friends.tab.ratings') },
                  { value: 'people', label: t('friends.tab.people') },
                ]}
              />
            </View>
            {tab === 'recos' ? <Recos me={me} /> : tab === 'ratings' ? <Ratings me={me} /> : <People me={me} />}
            <Group index={2} title={t('friends.name')}>
              <View style={styles.block}>
                <NameField />
              </View>
            </Group>
          </>
        ) : (
          <>
            <FadeIn style={styles.intro}>
              <Text style={styles.introTitle}>{t('friends.introTitle')}</Text>
              <Text style={styles.introBody}>{t('friends.introBody')}</Text>
            </FadeIn>
            <Group index={1} title={t('friends.name')}>
              <View style={styles.block}>
                <NameField />
              </View>
            </Group>
          </>
        )}
        <Text style={styles.footnote}>{t('friends.privacy')}</Text>
    </Screen>
  );
}

function Group({ title, index, children }: { title: string; index: number; children: ReactNode }) {
  const styles = useStyles();
  return (
    <FadeIn index={index} style={{ marginTop: 26, gap: 8 }}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.group}>{children}</View>
    </FadeIn>
  );
}

/** Every recommendation, latest first: the group's, the ones meant for you, or your own. */
function Recos({ me }: { me: string }) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { gutter } = useLayout();
  const members = useFriends((s) => s.members);
  const titles = useFriends((s) => s.titles);
  const recos = useFriends((s) => s.recos);
  const thanks = useFriends((s) => s.thanks);
  const d = useDigest();
  const hrefs = useLocalHrefs();
  const [filter, setFilter] = useState<RecoFilter>('all');

  const lists = useMemo(() => {
    const all = recos.filter((r) => members[r.user] && titles[r.title]).sort((a, b) => b.at - a.at);
    return { all, forMe: all.filter((r) => r.to === me), mine: all.filter((r) => r.user === me) };
  }, [recos, members, titles, me]);
  const list = lists[filter].slice(0, LIST);

  return (
    <View style={{ marginTop: 14, gap: 12 }}>
      <Chips<RecoFilter>
        inset={gutter}
        value={filter}
        onChange={setFilter}
        options={(['all', 'forMe', 'mine'] as const).map((f) => ({ value: f, label: t(`friends.filter.${f}`), count: lists[f].length }))}
      />
      {list.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="heart" size={22} color={palette.primaryText} />
          <Text style={styles.emptyText}>{t(filter === 'mine' ? 'friends.emptyMine' : filter === 'forMe' ? 'friends.emptyForMe' : 'friends.emptyRecos')}</Text>
        </View>
      ) : (
        list.map((r, i) => {
          const title = titles[r.title];
          const { href, have } = hrefs(title);
          const ribbon = d?.ribbons.get(title.id);
          const thanked = thanks.filter((x) => x.recoUser === r.user && x.title === r.title);
          return (
            <FadeIn key={`${r.user}-${r.title}`} index={i} distance={8}>
              <PressableScale depth={0.98} style={styles.card} onPress={() => router.push(href as never)} accessibilityLabel={title.title}>
                <Poster uri={title.poster} title={title.title} width={76} kind={title.kind} elevated={false} radius={8} ribbon={ribbon && bandOf(t, ribbon, members)} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {title.title}
                  </Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {[r.user === me ? t('friends.you') : members[r.user].name, title.year].filter(Boolean).join(' · ')}
                  </Text>
                  <View style={styles.tags}>
                    {r.favorite && (
                      <View style={[styles.tag, { backgroundColor: BAND_COLORS.red }]}>
                        <Text style={styles.tagText}>{t('friends.favorite')}</Text>
                      </View>
                    )}
                    {(!!r.band || r.stars != null) && (
                      <View style={[styles.tag, { backgroundColor: BAND_COLORS[r.color ?? 'red'] }]}>
                        <Text style={styles.quote} numberOfLines={2}>
                          {[r.stars != null ? starsText(r.stars) : undefined, r.band ? t('friends.quoted', { quote: r.band }) : undefined].filter(Boolean).join('  ')}
                        </Text>
                      </View>
                    )}
                    {!!r.to && members[r.to] && <Text style={styles.forWho}>{r.to === me ? t('friends.forYou') : t('friends.forName', { name: members[r.to].name })}</Text>}
                  </View>
                  {!!r.note && (
                    <Text style={styles.note} numberOfLines={3}>
                      {r.note}
                    </Text>
                  )}
                  <Text style={styles.cardState} numberOfLines={1}>
                    {[
                      have ? t('friends.inLibrary') : t('friends.notInLibrary'),
                      thanked.length
                        ? t('friends.thankedBy', {
                            names: thanked
                              .map((x) => (x.from === me ? t('friends.you') : members[x.from]?.name))
                              .filter(Boolean)
                              .join(', '),
                          })
                        : undefined,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              </PressableScale>
            </FadeIn>
          );
        })
      )}
    </View>
  );
}

/** What the group rated, best first, with who gave what. */
function Ratings({ me }: { me: string }) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { gutter } = useLayout();
  const members = useFriends((s) => s.members);
  const titles = useFriends((s) => s.titles);
  const d = useDigest();
  const hrefs = useLocalHrefs();
  const [kind, setKind] = useState<KindFilter>('all');

  const rows = useMemo(() => {
    const out = [...(d?.ratings ?? [])]
      .filter(([id]) => titles[id])
      .map(([id, list]) => ({ title: titles[id], list: [...list].sort((a, b) => b.rating - a.rating), average: list.reduce((n, r) => n + r.rating, 0) / list.length }));
    // Titles several people rated come first (that is where there is a verdict), then the best rated.
    return out.sort((a, b) => Number(b.list.length > 1) - Number(a.list.length > 1) || b.average - a.average || b.list.length - a.list.length || a.title.title.localeCompare(b.title.title));
  }, [d, titles]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.title.kind] = (c[r.title.kind] ?? 0) + 1;
    return c;
  }, [rows]);
  const list = rows.filter((r) => kind === 'all' || r.title.kind === kind).slice(0, LIST);

  return (
    <View style={{ marginTop: 14, gap: 10 }}>
      <Chips<KindFilter>
        inset={gutter}
        value={kind}
        onChange={setKind}
        options={(['all', 'show', 'movie', 'book', 'game'] as const)
          .filter((k) => k === 'all' || counts[k])
          .map((k) => ({ value: k, label: k === 'all' ? t('common.all') : t(KIND_LABEL[k]), count: counts[k] ?? 0 }))}
      />
      {list.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="star" size={22} color={palette.primaryText} />
          <Text style={styles.emptyText}>{t('friends.emptyRatings')}</Text>
        </View>
      ) : (
        list.map(({ title, list: who, average }, i) => {
          const ribbon = d?.ribbons.get(title.id);
          return (
            <FadeIn key={title.id} index={i} distance={8}>
              <PressableScale depth={0.98} style={[styles.card, { alignItems: 'center' }]} onPress={() => router.push(hrefs(title).href as never)} accessibilityLabel={title.title}>
                <Poster uri={title.poster} title={title.title} width={48} kind={title.kind} elevated={false} radius={6} />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.rowHead}>
                    <Text style={[styles.cardTitle, { flex: 1 }]} numberOfLines={1}>
                      {title.title}
                    </Text>
                    <StarBadge value={average} />
                  </View>
                  <Text style={styles.cardMeta} numberOfLines={2}>
                    {who.map((r) => `${r.user === me ? t('friends.you') : members[r.user]?.name} ★ ${(r.rating / 2).toLocaleString(undefined, { maximumFractionDigits: 1 })}`).join(' · ')}
                  </Text>
                  {!!ribbon && (ribbon.type === 'prize' || ribbon.type === 'unanimous' || ribbon.type === 'split') && <Text style={styles.verdict}>{bandOf(t, ribbon, members).text}</Text>}
                </View>
              </PressableScale>
            </FadeIn>
          );
        })
      )}
    </View>
  );
}

/** Who is there, what you share with them, your name, and the way out. */
function People({ me }: { me: string }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const haptics = useHaptics();
  const members = useFriends((s) => s.members);
  const ratings = useFriends((s) => s.ratings);
  const recos = useFriends((s) => s.recos);
  const shareRatings = useFriends((s) => s.shareRatings);
  const d = useDigest();
  const [leaving, setLeaving] = useState(false);
  const [sure, setSure] = useState(false);

  const list = Object.values(members).sort((a, b) => Number(b.id === me) - Number(a.id === me) || a.joinedAt - b.joinedAt);
  const leave = async () => {
    if (!sure) return setSure(true);
    setLeaving(true);
    try {
      await leaveFriends();
      useUi.getState().showToast(t('friends.left'));
    } catch {
      useUi.getState().showToast(t('friends.offline'));
      setLeaving(false);
    }
  };

  return (
    <>
      <Group index={0} title={t('friends.members', { count: list.length })}>
        {list.map((m, i) => {
          const affinity = d?.affinity.get(m.id);
          const counts = [
            t('friends.nRatings', { count: ratings.filter((r) => r.user === m.id).length }),
            t('friends.nRecos', { count: recos.filter((r) => r.user === m.id).length }),
          ].join(' · ');
          return (
            <View key={m.id} style={[styles.row, i < list.length - 1 && styles.line]}>
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={styles.rowLabel}>{m.id === me ? t('friends.nameYou', { name: m.name }) : m.name}</Text>
                <Text style={styles.hint}>{counts}</Text>
              </View>
              {affinity != null && (
                <View style={styles.affinity}>
                  <Text style={styles.affinityText}>{t('friends.affinity', { percent: Math.round(affinity * 100) })}</Text>
                </View>
              )}
            </View>
          );
        })}
      </Group>
      <Text style={styles.footnote}>{t('friends.quorum', { count: quorumFor(list.length) })}</Text>

      <Group index={1} title={t('friends.sharing')}>
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={styles.rowLabel}>{t('friends.shareRatings')}</Text>
            <Text style={styles.hint}>{t(shareRatings ? 'friends.shareRatingsOn' : 'friends.shareRatingsOff')}</Text>
          </View>
          <Switch
            value={shareRatings}
            onValueChange={(v) => {
              haptics.select();
              setShareRatings(v);
            }}
          />
        </View>
      </Group>

      <Group index={2} title={t('friends.name')}>
        <View style={styles.block}>
          <NameField />
        </View>
      </Group>

      <FadeIn index={3} style={{ marginTop: 26, gap: 8 }}>
        <Button label={t(sure ? 'friends.leaveSure' : 'friends.leave')} icon="trash" variant="danger" compact onPress={leave} loading={leaving} style={{ alignSelf: 'flex-start' }} />
        <Text style={styles.hint}>{t('friends.leaveHint')}</Text>
      </FadeIn>
    </>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  intro: { marginTop: 18, gap: 6 },
  introTitle: { ...type.title },
  introBody: { ...type.body, color: palette.inkSoft, lineHeight: 22 },
  groupTitle: { ...type.label, marginLeft: 4 },
  group: { borderRadius: radii.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline, overflow: 'hidden' },
  block: { padding: 14, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 },
  line: { borderBottomWidth: 1, borderBottomColor: palette.hairline },
  rowLabel: { ...fonts.medium, fontSize: 15, color: palette.ink },
  hint: { ...type.small, fontSize: 12.5, lineHeight: 17 },
  affinity: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: palette.primaryTint },
  affinityText: { ...fonts.semibold, fontSize: 12, color: palette.primaryText },
  footnote: { ...type.small, fontSize: 12, marginTop: 10, marginHorizontal: 4, lineHeight: 17 },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radii.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  emptyText: { ...type.small, flex: 1 },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 10, borderRadius: radii.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { ...fonts.semibold, fontSize: 15, color: palette.ink, letterSpacing: -0.15 },
  cardMeta: { ...fonts.body, fontSize: 12.5, color: palette.inkSoft },
  cardState: { ...fonts.medium, fontSize: 12, color: palette.inkFaint },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  tag: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, maxWidth: '100%' },
  tagText: { ...fonts.bold, fontSize: 10, letterSpacing: 0.4, color: '#FFFFFF', textTransform: 'uppercase' },
  quote: { ...fonts.displayItalic, fontWeight: '600', fontSize: 12.5, color: '#FFFFFF' },
  forWho: { ...fonts.medium, fontSize: 12, color: palette.primaryText },
  note: { ...fonts.displayItalic, fontSize: 15, lineHeight: 20, color: palette.ink },
  verdict: { ...fonts.semibold, fontSize: 11.5, letterSpacing: 0.3, color: BAND_COLORS.red, textTransform: 'uppercase' },
}));
