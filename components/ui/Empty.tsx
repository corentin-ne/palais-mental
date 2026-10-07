import { Text, View } from 'react-native';

import Button from './Button';
import Icon, { IconName } from './Icon';
import { FadeIn } from './Motion';
import { useTheme } from '@/constants/theme';

/** Calm empty state: one mark, one sentence, one way forward. */
export default function Empty({ icon, title, body, cta, onPress }: { icon: IconName; title: string; body?: string; cta?: string; onPress?: () => void }) {
  const { type, palette } = useTheme();
  return (
    <FadeIn style={{ alignItems: 'center', gap: 12, paddingVertical: 48, paddingHorizontal: 24 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={28} color={palette.primary} />
      </View>
      <Text style={[type.heading, { textAlign: 'center' }]}>{title}</Text>
      {!!body && <Text style={[type.small, { textAlign: 'center', maxWidth: 320 }]}>{body}</Text>}
      {cta && onPress && <Button label={cta} icon="search" onPress={onPress} compact style={{ marginTop: 6 }} />}
    </FadeIn>
  );
}
