import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Glass from './Glass';
import Icon, { IconName } from './Icon';
import PressableScale from './PressableScale';
import { palette, shadow } from '@/constants/theme';
import { CATEGORY_SPECS } from '@/lib/itemVisuals';
import { ZONE_SEQUENCE } from '@/lib/palaceLayout';
import { CameraFocus } from '@/lib/types';

interface Props {
  focus: CameraFocus;
  onFocus: (focus: CameraFocus) => void;
  onAdd: () => void;
}

/**
 * The room's table of contents, in the same order as a turn of the head: the window,
 * then each niche around the circle. The + beside it opens the log sheet.
 */
export default function Dock({ focus, onFocus, onAdd }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.row} pointerEvents="box-none">
      <Glass radius={30} contentStyle={styles.dock}>
        {ZONE_SEQUENCE.map((z) => {
          const active = z === focus;
          const accent = z === 'window' ? palette.ink : CATEGORY_SPECS[z].accent;
          const tint = z === 'window' ? palette.fieldActive : CATEGORY_SPECS[z].tint;
          return (
            <PressableScale
              key={z}
              onPress={() => onFocus(z)}
              accessibilityLabel={z === 'window' ? t('nav.window') : t(`categories.${z}`)}
              accessibilityState={{ selected: active }}
              style={[styles.slot, active && { backgroundColor: tint }]}
              depth={0.88}
            >
              <Icon name={z as IconName} size={21} color={active ? accent : palette.inkSoft} strokeWidth={active ? 2 : 1.7} />
            </PressableScale>
          );
        })}
      </Glass>
      <PressableScale onPress={onAdd} accessibilityLabel={t('nav.add')} style={styles.add} depth={0.9}>
        <Icon name="plus" size={26} color={palette.onInk} strokeWidth={2.2} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16 },
  dock: { flexDirection: 'row', padding: 6, gap: 2 },
  slot: { width: 40, height: 48, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  add: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.lifted,
  },
});
