import { Chip, ChipRow } from '@/spark';
import { useHaptics } from '@/hooks/useHaptics';

interface Props<T extends string> {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  inset: number;
}

/** One-line filter chips with counts (the kit's chips) that scroll sideways past the screen edge. */
export default function Chips<T extends string>({ options, value, onChange, inset }: Props<T>) {
  const haptics = useHaptics();
  return (
    <ChipRow inset={inset}>
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          count={o.count}
          active={o.value === value}
          onPress={() => {
            if (o.value === value) return;
            haptics.select();
            onChange(o.value);
          }}
        />
      ))}
    </ChipRow>
  );
}
