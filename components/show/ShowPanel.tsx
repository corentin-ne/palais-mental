import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/Button';
import NoteInput from '@/components/ui/NoteInput';
import PressableScale from '@/components/ui/PressableScale';
import StarRating from '@/components/ui/StarRating';
import { FadeIn } from '@/components/ui/Motion';
import { makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { removeShow, setDropped } from '@/lib/actions';
import { countdown, relativeDay } from '@/lib/format';
import { Progress, episodeCode } from '@/lib/progress';
import { Episode, Show, ShowState } from '@/lib/types';
import { useLibrary } from '@/store/useLibrary';

/** Where you are in a show, and the one action that matters most right now; following it when you don't yet. */
export default function ShowPanel({
  id,
  show,
  tracked,
  progress,
  state,
  canFollow,
  onFollow,
  onToggle,
  onMarkMany,
}: {
  id: string;
  show: Show;
  tracked: boolean;
  progress: Progress;
  state?: ShowState;
  canFollow: boolean;
  onFollow: () => void;
  onToggle: (e: Episode) => void;
  onMarkMany: (list: Episode[], message: string) => void;
}) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const haptics = useHaptics();
  return (
    <FadeIn index={3} style={styles.panel}>
      {tracked ? (
        <>
          <View style={styles.progressHead}>
            <Text style={styles.progressText}>
              {state === 'dropped'
                ? t('state.dropped')
                : progress.aired
                  ? t('show.progress', { count: Math.min(progress.watched, progress.aired), watched: Math.min(progress.watched, progress.aired), aired: progress.aired })
                  : t('show.notAired')}
            </Text>
            <Text style={styles.progressState}>{state ? t(`state.${state}`) : ''}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progress.fraction * 100)}%`, backgroundColor: progress.fraction >= 1 ? palette.success : palette.primary }]} />
          </View>
          {progress.next && state !== 'dropped' && (
            <Button label={t('show.watchedNext', { code: episodeCode(progress.next) })} icon="check" onPress={() => onToggle(progress.next!)} style={{ marginTop: 6 }} />
          )}
          {progress.left > 1 && state !== 'dropped' && (
            <PressableScale onPress={() => onMarkMany(progress.ahead, t('toast.caughtUp', { title: show.title }))} style={{ alignSelf: 'center', paddingVertical: 4 }}>
              <Text style={styles.allLink}>{t('show.watchAll', { count: progress.left })}</Text>
            </PressableScale>
          )}
          {/* Started mid-way: the earlier episodes stay out of the way, one tap marks them if you saw them elsewhere. */}
          {progress.skipped.length > 0 && progress.watched > 0 && (
            <PressableScale onPress={() => onMarkMany(progress.skipped, t('toast.earlierWatched', { count: progress.skipped.length }))} style={{ alignSelf: 'center', paddingVertical: 2 }}>
              <Text style={styles.skippedLink}>{t('show.skipped', { count: progress.skipped.length })}</Text>
            </PressableScale>
          )}
          {!progress.next && progress.upcoming?.airstamp && (
            <Text style={styles.nextAir}>{t('show.nextAirs', { code: episodeCode(progress.upcoming), when: countdown(progress.upcoming.airstamp) })}</Text>
          )}
          <View style={styles.rate}>
            <Text style={styles.rateLabel}>{t('rating.yours')}</Text>
            <StarRating value={show.rating} onChange={(v) => useLibrary.getState().setShowRating(id, v)} size={24} />
          </View>
          <NoteInput
            value={show.review}
            placeholder={t('journal.placeholder.show')}
            onSave={(text) => useLibrary.getState().setShowReview(id, text)}
          />
          <View style={styles.actions}>
            <Button
              label={state === 'dropped' ? t('show.resume') : t('show.drop')}
              icon={state === 'dropped' ? 'play' : 'pause'}
              variant="ghost"
              compact
              onPress={() => {
                haptics.tap();
                setDropped(id, state !== 'dropped');
              }}
            />
            <Button label={t('common.remove')} icon="trash" variant="danger" compact onPress={() => removeShow(id)} />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.progressText}>
            {progress.upcoming?.airstamp ? t('show.followHintNext', { when: relativeDay(progress.upcoming.airstamp) }) : t('show.followHint')}
          </Text>
          <Button label={t('show.follow')} icon="plus" onPress={onFollow} disabled={!canFollow} />
        </>
      )}
    </FadeIn>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  panel: { marginTop: 22, padding: 16, gap: 10, borderRadius: radii.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  progressText: { ...fonts.medium, fontSize: 14.5, color: palette.ink },
  progressState: { ...fonts.semibold, fontSize: 12.5, color: palette.primaryText },
  track: { height: 6, borderRadius: 3, backgroundColor: palette.field, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  nextAir: { ...type.small, color: palette.primaryText },
  allLink: { ...fonts.semibold, fontSize: 13.5, color: palette.primaryText },
  skippedLink: { ...fonts.medium, fontSize: 12.5, color: palette.inkSoft, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  rate: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  rateLabel: { ...type.label },
}));
