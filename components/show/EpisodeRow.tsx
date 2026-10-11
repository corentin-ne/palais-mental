import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';

import CheckButton from '@/components/ui/CheckButton';
import Icon from '@/components/ui/Icon';
import NoteInput from '@/components/ui/NoteInput';
import PressableScale from '@/components/ui/PressableScale';
import StarRating, { StarBadge } from '@/components/ui/StarRating';
import { FadeIn } from '@/components/ui/Motion';
import { makeStyles, useTheme } from '@/constants/theme';
import { countdown, fullDate, relativeDay } from '@/lib/format';
import { episodeCode, hasAired } from '@/lib/progress';
import { Episode, EpisodeNote } from '@/lib/types';
import { Lit } from '@/spark';

/** One episode: its still, code and name, a tick, and once open the synopsis, your note and what friends said. */
export default function EpisodeRow({
  e,
  index,
  watched,
  isNext,
  note,
  synopsis,
  open,
  onOpen,
  onToggle,
  onUpTo,
  onNote,
  talk,
  talkCount,
}: {
  e: Episode;
  index: number;
  watched: boolean;
  /** Where you pick up: ringed in the accent. */
  isNext?: boolean;
  note?: EpisodeNote;
  synopsis?: string;
  open: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onUpTo: () => void;
  onNote: (patch: Partial<Omit<EpisodeNote, 'at'>>) => void;
  /** What friends said about it (closed until you have seen it), and how many messages that is. */
  talk?: ReactNode;
  talkCount?: number;
}) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const aired = hasAired(e);
  return (
    <FadeIn index={index} distance={8}>
      <Lit style={[styles.episode, isNext && styles.episodeNext, !aired && { opacity: 0.6 }]}>
        <PressableScale depth={0.99} onPress={onOpen} style={{ gap: 10 }}>
          <View style={styles.epTop}>
            <View style={styles.still}>
              {e.image ? <Image source={{ uri: e.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : <Text style={styles.stillNum}>{e.number}</Text>}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={styles.epCodeRow}>
                <Text style={styles.epCode}>{episodeCode(e)}</Text>
                {isNext && <Text style={styles.nextTag}>{t('show.upNext')}</Text>}
                {note?.rating != null && <StarBadge value={note.rating} />}
                {!!note?.text && <Icon name="journal" size={13} color={palette.primaryText} />}
                {!!talkCount && (
                  <View style={styles.talkCount}>
                    <Icon name="send" size={10} color={palette.primaryText} strokeWidth={2.2} />
                    <Text style={styles.talkCountText}>{talkCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.epName} numberOfLines={open ? undefined : 2}>
                {e.name || t('show.episodeN', { n: e.number })}
              </Text>
              <Text style={styles.epDate}>
                {e.airstamp ? (aired ? fullDate(e.airstamp) : `${relativeDay(e.airstamp)} · ${countdown(e.airstamp)}`) : t('show.tba')}
              </Text>
            </View>
            <CheckButton checked={watched} onPress={onToggle} onLongPress={aired ? onUpTo : undefined} disabled={!aired} label={episodeCode(e)} />
          </View>
          {open && !!synopsis && <Text style={styles.epSynopsis}>{synopsis}</Text>}
        </PressableScale>
        {/* Your own take, once the episode is out: a rating and a few words, kept for you. */}
        {open && aired && (
          <View style={styles.notePanel}>
            <View style={styles.rate}>
              <Text style={styles.rateLabel}>{t('journal.episodeRating')}</Text>
              <StarRating value={note?.rating} onChange={(rating) => onNote({ rating })} size={20} />
            </View>
            <NoteInput value={note?.text} placeholder={t('journal.notePlaceholder')} onSave={(text) => onNote({ text })} />
          </View>
        )}
        {open && aired && talk}
      </Lit>
    </FadeIn>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  rate: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  rateLabel: { ...type.label },
  episode: { padding: 10, borderRadius: radii.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline, gap: 10 },
  episodeNext: { borderColor: palette.primaryRing, backgroundColor: palette.primaryTint },
  nextTag: { ...fonts.semibold, fontSize: 11, letterSpacing: 0.3, color: palette.primaryText },
  epCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  talkCount: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: palette.primaryTint },
  talkCountText: { ...fonts.semibold, fontSize: 11, color: palette.primaryText },
  notePanel: { gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: palette.hairline },
  epTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  still: { width: 96, height: 56, borderRadius: 8, overflow: 'hidden', backgroundColor: palette.field, alignItems: 'center', justifyContent: 'center' },
  stillNum: { ...fonts.displayItalic, fontSize: 22, color: palette.inkFaint },
  epCode: { ...fonts.semibold, fontSize: 11, letterSpacing: 0.6, color: palette.inkFaint },
  epName: { ...fonts.semibold, fontSize: 14.5, color: palette.ink, letterSpacing: -0.15 },
  epDate: { ...fonts.body, fontSize: 12, color: palette.inkSoft },
  epSynopsis: { ...type.small, color: palette.inkSoft, lineHeight: 19 },
}));
