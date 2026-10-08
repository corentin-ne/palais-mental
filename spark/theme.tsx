/**
 * Spark UI kit · native/theme.tsx
 * The tokens in React context: `<SparkProvider>` at the root, `useSpark()` anywhere, and `sparkStyles()`
 * for StyleSheets built once per token set (theme × accent × quality), never on every render.
 */
import { ReactNode, createContext, useContext, useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { SparkTokens, TokenOptions, createTokens } from './tokens';

const SparkContext = createContext<SparkTokens>(createTokens({ scheme: 'dark' }));

/** Token sets are cached by their inputs: switching back to a theme reuses its objects (and every style cache). */
const sets = new Map<string, SparkTokens>();
export function tokensFor(options: TokenOptions): SparkTokens {
  const key = JSON.stringify([options.scheme, options.accent ?? '', !!options.lite, !!options.contrast, !!options.reduceMotion]);
  let t = sets.get(key);
  if (!t) {
    t = createTokens(options);
    sets.set(key, t);
  }
  return t;
}

export function SparkProvider({ children, ...options }: TokenOptions & { children: ReactNode }) {
  const tokens = useMemo(() => tokensFor(options), [options.scheme, options.accent, options.lite, options.contrast, options.reduceMotion]);
  return <SparkContext.Provider value={tokens}>{children}</SparkContext.Provider>;
}

export const useSpark = () => useContext(SparkContext);

/** `const useStyles = sparkStyles((t) => ({ … }))`, then `const s = useStyles()` in the component. */
export function sparkStyles<T extends StyleSheet.NamedStyles<T>>(factory: (t: SparkTokens) => T) {
  const cache = new WeakMap<SparkTokens, T>();
  return function useStyles(): T {
    const t = useSpark();
    let s = cache.get(t);
    if (!s) {
      s = StyleSheet.create(factory(t));
      cache.set(t, s);
    }
    return s;
  };
}
