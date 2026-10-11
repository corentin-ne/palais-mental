import { useCallback, useState } from 'react';

/**
 * How many items of a long list to render: a first few screens, then a batch more each time
 * `more` is called (the end of the page coming near). Starts over when `resetKey` changes.
 */
export function useProgressive(total: number, resetKey: string, first = 30, step = 30): [shown: number, more: () => void] {
  const [state, setState] = useState({ key: resetKey, count: first });
  const count = state.key === resetKey ? state.count : first;
  const more = useCallback(
    () => setState((s) => (s.key !== resetKey ? { key: resetKey, count: first + step } : s.count >= total ? s : { key: resetKey, count: s.count + step })),
    [resetKey, total, first, step],
  );
  return [Math.min(count, total), more];
}
