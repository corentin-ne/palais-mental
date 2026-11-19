import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import Icon from '@/components/ui/Icon';
import { FadeIn } from '@/components/ui/Motion';
import { makeStyles, useTheme } from '@/constants/theme';
import { daysFromToday, duration, relativeDay } from '@/lib/format';
import { FAR, Pace } from '@/lib/pace';

/** "About 9 h left · done around Friday at your pace": what is left, and when you'd be through it. */
export default function PaceLine({ pace }: { pace?: Pace }) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  if (!pace) return null;
  const left =
    pace.unit === 'minutes' ? t('pace.timeLeft', { time: duration(pace.left) }) : pace.unit === 'pages' ? t('pace.pagesLeft', { count: pace.left }) : t('pace.hoursLeft', { count: pace.left });
  const now = Date.now();
  const when = pace.finishAt == null ? undefined : pace.finishAt - now > FAR ? t('pace.far') : daysFromToday(pace.finishAt) < 7 ? t('pace.doneBy', { when: relativeDay(pace.finishAt).toLocaleLowerCase() }) : t('pace.doneAround', { when: relativeDay(pace.finishAt) });
  return (
    <FadeIn style={styles.row} distance={6}>
      <Icon name="clock" size={15} color={palette.primaryText} strokeWidth={2.2} />
      <Text style={styles.text} accessibilityRole="text">
        <Text style={styles.strong}>{left}</Text>
        {when ? ` · ${when}` : ''}
      </Text>
    </FadeIn>
  );
}

const useStyles = makeStyles(({ palette, fonts }) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  text: { ...fonts.medium, fontSize: 13, color: palette.inkSoft, flex: 1 },
  strong: { ...fonts.semibold, color: palette.ink },
}));
