import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import Icon from './Icon';
import PressableScale from './PressableScale';
import { makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { useLibrary } from '@/store/useLibrary';

/** Search, from the title row of a screen: every show, film, book and game to add. In solo mode the bar has it, unless there is a query to carry over. */
export default function SearchButton({ query }: { query?: string }) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const haptics = useHaptics();
  const solo = useLibrary((s) => s.settings.solo);
  if (solo && !query) return null;
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
