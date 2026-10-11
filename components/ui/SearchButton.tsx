import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import Icon from './Icon';
import PressableScale from './PressableScale';
import { makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';

/** Search, from the title row of a screen: every show, film, book and game to add. */
export default function SearchButton({ query }: { query?: string }) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const haptics = useHaptics();
  return (
    <PressableScale
      onPress={() => {
        haptics.tap();
        router.push(query ? { pathname: '/search', params: { q: query } } : '/search');
      }}
      style={styles.button}
      accessibilityLabel={t('search.title')}
    >
      <Icon name="search" size={20} color={palette.ink} strokeWidth={2.1} />
    </PressableScale>
  );
}

const useStyles = makeStyles(({ palette }) => ({
  button: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline, marginBottom: 2 },
}));
