import { useEffect, useState } from 'react';

/**
 * How many items of a long list to render: a first screenful at once, then the rest a batch per
 * frame, so a big library opens without a stall. Starts over when `resetKey` changes.
 */
export function useProgressive(total: number, resetKey: string, first = 30, step = 30) {
  const [state, setState] = useState({ key: resetKey, count: first });
  const count = state.key === resetKey ? state.count : first;
  useEffect(() => {
    if (state.key !== resetKey) setState({ key: resetKey, count: first });
    else if (count < total) {
      const timer = setTimeout(() => setState((s) => ({ ...s, count: s.count + step })), 16);
      return () => clearTimeout(timer);
    }
  }, [state.key, resetKey, count, total, first, step]);
  return Math.min(count, total);
}
