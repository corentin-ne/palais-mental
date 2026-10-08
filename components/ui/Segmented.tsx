import { Segmented as SparkSegmented } from '@/spark';
import { useHaptics } from '@/hooks/useHaptics';

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}

/** The kit's segmented control: equal segments, a thumb that slides between them. */
export default function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  const haptics = useHaptics();
  return (
    <SparkSegmented
      value={value}
      options={options}
      style={{ width: '100%', maxWidth: 460 }}
      onChange={(v) => {
        if (v === value) return;
        haptics.select();
        onChange(v);
      }}
    />
  );
}
