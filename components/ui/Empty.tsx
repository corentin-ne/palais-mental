import Button from './Button';
import { IconName, glyph } from './Icon';
import { FadeIn } from './Motion';
import { EmptyState } from '@/spark';

/** The kit's empty state: the accent tile, one sentence, one way forward. */
export default function Empty({ icon, title, body, cta, onPress }: { icon: IconName; title: string; body?: string; cta?: string; onPress?: () => void }) {
  return (
    <FadeIn>
      <EmptyState icon={glyph(icon)} title={title} body={body} action={cta && onPress ? <Button label={cta} icon="search" onPress={onPress} style={{ marginTop: 8 }} /> : undefined} />
    </FadeIn>
  );
}
