import { useCallback, useRef } from 'react';

/** A handler whose identity never changes while it always runs the latest version: what memoised rows are given. */
export function useStable<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const latest = useRef(fn);
  latest.current = fn;
  return useCallback((...args: A) => latest.current(...args), []);
}
