import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import PressableScale from '@/components/ui/PressableScale';
import { StarBadge } from '@/components/ui/StarRating';
import { FadeIn, animateLayout } from '@/components/ui/Motion';
import { makeStyles, noOutline, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { Shareable, dismiss, errorCode, findTitle, localKey, recommend, setRatingShared, thank, unrecommend } from '@/lib/friends';
import { quoteBand, starsText, useDigest } from '@/lib/ribbons';
import type { MediaKind } from '@/lib/types';
import { Switch } from '@/spark';
import { BAND_COLORS, BandColor, Reco, useFriends } from '@/store/useFriends';
import { useUi } from '@/store/useUi';

const COLORS = Object.keys(BAND_COLORS) as BandColor[];

interface Props {
  kind: MediaKind;
  item: Shareable;
  tracked: boolean;
  /** Your own rating of it (1–10), if you gave one: to show or hide, and to put on a band. */
  rating?: number;
}

/**
 * What the others made of a title: their ratings, what they said when recommending it, and your own
 * recommendation, with a band of your own across the poster if you write one. Absent until you have a name.
 */
export default function FriendsBlock({ kind, item, tracked, rating }: Props) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const haptics = useHaptics();
  const me = useFriends((s) => s.me);
  const members = useFriends((s) => s.members);
  const titles = useFriends((s) => s.titles);
  const thanks = useFriends((s) => s.thanks);
  const dismissed = useFriends((s) => s.dismissed);
  const shareRatings = useFriends((s) => s.shareRatings);
  const choice = useFriends((s) => s.shared[localKey(kind, item)]);
  const d = useDigest();
  const id = useMemo(() => findTitle(titles, kind, item), [titles, kind, item]);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState('');
  const [band, setBand] = useState('');
  const [color, setColor] = useState<BandColor>('red');
  const [stars, setStars] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [to, setTo] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (!me || !d) return null;
  const toast = (key: string) => useUi.getState().showToast(t(key));
  const ratings = (id != null ? d.ratings.get(id) : undefined) ?? [];
  const recos = ((id != null ? d.recos.get(id) : undefined) ?? []).slice().sort((a, b) => Number(b.user === me) - Number(a.user === me) || a.at - b.at);
  const mine = recos.find((r) => r.user === me);
  const others = Object.values(members).filter((m) => m.id !== me);
  const average = ratings.length ? ratings.reduce((n, r) => n + r.rating, 0) / ratings.length : undefined;
  const waved = id != null && dismissed.includes(id);
  const visible = choice ?? shareRatings;
  const preview = band.trim() || (stars && rating != null) ? quoteBand(t, { band: band.trim() || undefined, color, stars: stars ? rating : undefined }, members[me]?.name ?? '') : undefined;

  const open = () => {
    animateLayout(220);
    setNote(mine?.note ?? '');
    setBand(mine?.band ?? '');
    setColor(mine?.color ?? 'red');
    setStars(mine?.stars != null);
    setFavorite(mine?.favorite ?? false);
    setTo(mine?.to);
    setEditing(true);
  };
  const save = async () => {
    setBusy(true);
    try {
      await recommend(kind, item, { note, band, color, stars: stars ? rating : undefined, favorite, to });
      haptics.success();
      animateLayout(220);
      setEditing(false);
      toast(mine ? 'friends.recoUpdated' : 'friends.recoSent');
    } catch (err) {
      toast(errorCode(err) === 'favorites_full' ? 'friends.favoritesFull' : 'friends.offline');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (id == null) return;
    try {
      await unrecommend(id);
      animateLayout(220);
      setEditing(false);
    } catch {
      toast('friends.offline');
    }
  };
  const onThank = async (reco: Reco, on: boolean) => {
    haptics.tap();
    try {
      await thank(reco, on);
    } catch {
      toast('friends.offline');
    }
  };

  return (
    <FadeIn index={4} style={styles.panel}>
      <View style={styles.head}>
        <Text style={styles.label}>{t('friends.block')}</Text>
        {average != null && (
          <View style={styles.average}>
            <StarBadge value={average} />
            <Text style={styles.count}>{t('friends.ratings', { count: ratings.length })}</Text>
          </View>
        )}
      </View>

      {ratings.length > 0 && (
        <View style={styles.chips}>
          {ratings.map((r) => (
            <View key={r.user} style={styles.chip}>
              <Text style={styles.chipName}>{r.user === me ? t('friends.you') : members[r.user]?.name}</Text>
              <StarBadge value={r.rating} />
            </View>
          ))}
        </View>
      )}

      {/* Your rating, title by title: shown or kept to yourself, whatever the general rule in Social. */}
      {rating != null && (
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={styles.rowLabel}>{t('friends.showRating')}</Text>
            <Text style={styles.hint}>{t(visible ? 'friends.ratingShown' : 'friends.ratingHidden')}</Text>
          </View>
          <Switch
            value={visible}
            onValueChange={(v) => {
              haptics.select();
              setRatingShared(kind, item, v);
            }}
          />
        </View>
      )}

      {recos.map((r) => {
        const own = r.user === me;
        const thanked = thanks.filter((x) => x.recoUser === r.user && x.title === r.title);
        const byMe = thanked.some((x) => x.from === me);
        return (
          <View key={r.user} style={styles.reco}>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.recoHead}>
                <Text style={styles.recoName}>{own ? t('friends.yourReco') : t('friends.recoBy', { name: members[r.user]?.name })}</Text>
                {r.favorite && (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{t('friends.favorite')}</Text>
                  </View>
                )}
                {!!r.to && members[r.to] && <Text style={styles.forWho}>{r.to === me ? t('friends.forYou') : t('friends.forName', { name: members[r.to].name })}</Text>}
              </View>
              {(!!r.band || r.stars != null) && (
                <View style={[styles.band, { backgroundColor: BAND_COLORS[r.color ?? 'red'] }]}>
                  <Text style={styles.bandText}>{[r.stars != null ? starsText(r.stars) : undefined, r.band ? t('friends.quoted', { quote: r.band }) : undefined].filter(Boolean).join('  ')}</Text>
                </View>
              )}
              {!!r.note && <Text style={styles.note}>{r.note}</Text>}
              {own && thanked.length > 0 && (
                <Text style={styles.thanked}>
                  {t('friends.thankedBy', {
                    names: thanked
                      .map((x) => members[x.from]?.name)
                      .filter(Boolean)
                      .join(', '),
                  })}
                </Text>
              )}
            </View>
            {!own && (
              <PressableScale depth={0.85} hitSlop={8} onPress={() => onThank(r, !byMe)} accessibilityLabel={t('friends.thank')} accessibilityState={{ selected: byMe }} style={[styles.thank, byMe && styles.thankOn]}>
                <Icon name="heart" size={16} color={byMe ? palette.primaryText : palette.inkFaint} strokeWidth={2.2} />
              </PressableScale>
            )}
          </View>
        );
      })}

      {!ratings.length && !recos.length && !editing && <Text style={styles.hint}>{t('friends.nothingYet')}</Text>}

      {editing ? (
        <View style={styles.editor}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t('friends.notePlaceholder')}
            placeholderTextColor={palette.inkFaint}
            maxLength={280}
            multiline
            textAlignVertical="top"
            style={[styles.input, noOutline]}
          />

          {/* A band of your own: a few words quoted across the poster, in your colour, your stars above if you like. */}
          <View style={{ gap: 8 }}>
            <Text style={styles.rowLabel}>{t('friends.bandTitle')}</Text>
            <TextInput value={band} onChangeText={setBand} placeholder={t('friends.bandPlaceholder')} placeholderTextColor={palette.inkFaint} maxLength={40} style={[styles.field, noOutline]} />
            <View style={styles.swatches} accessibilityRole="radiogroup">
              {COLORS.map((c) => (
                <PressableScale
                  key={c}
                  depth={0.88}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: c === color }}
                  accessibilityLabel={t(`friends.color.${c}`)}
                  onPress={() => {
                    haptics.select();
                    setColor(c);
                  }}
                  style={[styles.swatchRing, c === color && { borderColor: palette.ink }]}
                >
                  <View style={[styles.swatch, { backgroundColor: BAND_COLORS[c] }]} />
                </PressableScale>
              ))}
            </View>
            {rating != null && (
              <View style={styles.row}>
                <Text style={[styles.hint, { flex: 1 }]}>{t('friends.bandStars')}</Text>
                <Switch value={stars} onValueChange={setStars} />
              </View>
            )}
            {preview ? (
              <View style={[styles.band, styles.preview, { backgroundColor: preview.color }]}>
                {preview.stars != null && <Text style={styles.previewStars}>{starsText(preview.stars)}</Text>}
                <Text style={styles.bandText}>{preview.text}</Text>
              </View>
            ) : (
              <Text style={styles.hint}>{t('friends.bandHint')}</Text>
            )}
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={styles.rowLabel}>{t('friends.favorite')}</Text>
              <Text style={styles.hint}>{t('friends.favoriteHint')}</Text>
            </View>
            <Switch value={favorite} onValueChange={setFavorite} />
          </View>
          {others.length > 0 && (
            <View style={{ gap: 6 }}>
              <Text style={styles.rowLabel}>{t('friends.forWho')}</Text>
              <View style={styles.chips}>
                {[undefined, ...others.map((m) => m.id)].map((who) => (
                  <PressableScale key={who ?? 'all'} depth={0.92} onPress={() => setTo(who)} accessibilityState={{ selected: to === who }} style={[styles.chip, styles.pick, to === who && styles.pickOn]}>
                    <Text style={styles.chipName}>{who ? members[who].name : t('friends.everyone')}</Text>
                  </PressableScale>
                ))}
              </View>
            </View>
          )}
          <View style={styles.actions}>
            <Button label={t(mine ? 'common.save' : 'friends.send')} icon="check" compact onPress={save} loading={busy} />
            <Button
              label={t('common.cancel')}
              variant="ghost"
              compact
              onPress={() => {
                animateLayout(220);
                setEditing(false);
              }}
            />
            {mine && <Button label={t('friends.unrecommend')} icon="trash" variant="danger" compact onPress={remove} />}
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <Button label={t(mine ? 'friends.editReco' : 'friends.recommend')} icon={mine ? 'edit' : 'heart'} variant="secondary" compact onPress={open} />
          {/* Not on your list, and the others push it: wave it off and it leaves your suggestions. */}
          {!tracked && id != null && recos.some((r) => r.user !== me) && (
            <Button label={t(waved ? 'friends.notForMeUndo' : 'friends.notForMe')} variant="ghost" compact onPress={() => dismiss(id, !waved)} />
          )}
        </View>
      )}
    </FadeIn>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  panel: { marginTop: 14, padding: 16, gap: 12, borderRadius: radii.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { ...type.label },
  average: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  count: { ...fonts.body, fontSize: 12, color: palette.inkSoft },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 10, paddingRight: 5, paddingVertical: 4, borderRadius: 14, backgroundColor: palette.field },
  chipName: { ...fonts.medium, fontSize: 13, color: palette.ink },
  pick: { paddingHorizontal: 11, paddingVertical: 7, borderWidth: 1, borderColor: 'transparent' },
  pickOn: { backgroundColor: palette.primaryTint, borderColor: palette.primaryRing },
  reco: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  recoHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  recoName: { ...fonts.semibold, fontSize: 13.5, color: palette.ink },
  tag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#C8102E' },
  tagText: { ...fonts.bold, fontSize: 10, letterSpacing: 0.4, color: '#FFFFFF', textTransform: 'uppercase' },
  forWho: { ...fonts.medium, fontSize: 12, color: palette.primaryText },
  band: { alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  bandText: { ...fonts.displayItalic, fontWeight: '600', fontSize: 13, color: '#FFFFFF', textAlign: 'center' },
  preview: { alignSelf: 'stretch', borderRadius: 0, paddingVertical: 6, gap: 1 },
  previewStars: { fontSize: 11, letterSpacing: 1, color: '#FFFFFF', textAlign: 'center' },
  note: { ...fonts.displayItalic, fontSize: 16, lineHeight: 21, color: palette.ink },
  thanked: { ...fonts.medium, fontSize: 12, color: palette.primaryText },
  thank: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.field, borderWidth: 1, borderColor: 'transparent' },
  thankOn: { backgroundColor: palette.primaryTint, borderColor: palette.primaryRing },
  hint: { ...type.small, fontSize: 12.5, lineHeight: 17 },
  editor: { gap: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: palette.hairline },
  input: { minHeight: 64, borderRadius: 12, padding: 12, backgroundColor: palette.field, ...fonts.displayItalic, fontSize: 16, lineHeight: 21, color: palette.ink },
  field: { height: 42, borderRadius: 12, paddingHorizontal: 12, backgroundColor: palette.field, ...fonts.body, fontSize: 14.5, color: palette.ink },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  swatchRing: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 28, height: 28, borderRadius: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLabel: { ...fonts.medium, fontSize: 14, color: palette.ink },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
}));
