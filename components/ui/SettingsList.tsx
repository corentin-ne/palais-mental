import { ReactNode } from 'react';
import { Text, View } from 'react-native';

import Icon, { IconName } from './Icon';
import PressableScale from './PressableScale';
import { FadeIn } from './Motion';
import { makeStyles, useTheme } from '@/constants/theme';

/** Grouped rows shared by Settings and Your data: a titled card of rows, blocks and links. */
export function Group({ title, index, children }: { title: string; index: number; children: ReactNode }) {
  const styles = useStyles();
  return (
    <FadeIn index={index} style={{ marginTop: 26, gap: 8 }}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.group}>{children}</View>
    </FadeIn>
  );
}

/** The icon tile of a row: the accent's soft tint (one accent colour, Spark UI kit), whatever the row. */
export function Tile({ icon }: { icon: IconName; tint?: string }) {
  const { palette } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.tile}>
      <Icon name={icon} size={17} color={palette.primaryText} strokeWidth={2} />
    </View>
  );
}

export function Row({ icon, tint, label, hint, last, children }: { icon: IconName; tint: string; label: string; hint?: string; last?: boolean; children?: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={[styles.row, !last && styles.line]}>
      <Tile icon={icon} tint={tint} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {!!hint && <Text style={styles.rowHint}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

export function Block({ icon, tint, label, last, children }: { icon: IconName; tint: string; label: string; last?: boolean; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={[styles.block, !last && styles.line]}>
      <View style={styles.rowHead}>
        <Tile icon={icon} tint={tint} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

export function ActionRow({ onPress, ...row }: { icon: IconName; tint: string; label: string; hint?: string; last?: boolean; onPress: () => void }) {
  const { palette } = useTheme();
  return (
    <PressableScale depth={0.98} onPress={onPress} accessibilityLabel={row.label}>
      <Row {...row}>
        <Icon name="chevronRight" size={16} color={palette.inkFaint} />
      </Row>
    </PressableScale>
  );
}

/** A screen header with a back button and a big title. */
export function Header({ title, top, gutter, width, onBack, backLabel }: { title: string; top: number; gutter: number; width: number; onBack: () => void; backLabel: string }) {
  const { palette, type } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.header, { paddingTop: top + 8, paddingHorizontal: gutter, width }]}>
      <PressableScale onPress={onBack} style={styles.back} accessibilityLabel={backLabel}>
        <Icon name="back" size={20} color={palette.ink} strokeWidth={2.2} />
      </PressableScale>
      <Text style={type.hero}>{title}</Text>
    </View>
  );
}

export const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  root: { flex: 1, backgroundColor: palette.screen, alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 4 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  groupTitle: { ...type.label, marginLeft: 4 },
  group: { borderRadius: radii.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline, overflow: 'hidden' },
  tile: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primaryTint },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 },
  line: { borderBottomWidth: 1, borderBottomColor: palette.hairline },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  block: { padding: 14, gap: 12 },
  rowLabel: { ...fonts.medium, fontSize: 15, color: palette.ink },
  rowHint: { ...type.small, fontSize: 12.5, lineHeight: 17 },
  footnote: { ...type.small, fontSize: 12, marginTop: 8, marginHorizontal: 4 },
}));
