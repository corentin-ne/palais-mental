import { Component, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface Props {
  children: ReactNode;
  /** Rendered instead of the full error screen (e.g. an empty room when the 3D view fails). */
  fallback?: ReactNode;
  label?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors so a failure shows up as a readable message instead of the
 * app closing. `fallback` keeps the rest of the interface usable.
 */
export default class SafeBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`[${this.props.label ?? 'app'}]`, error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Something went wrong</Text>
        <ScrollView style={styles.box}>
          <Text selectable style={styles.mono}>
            {String(error?.message ?? error)}
            {'\n\n'}
            {error?.stack?.slice(0, 1500)}
          </Text>
        </ScrollView>
        <Pressable style={styles.button} onPress={() => this.setState({ error: null })}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EAF3FB', padding: 24, paddingTop: 72, gap: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#0A2540' },
  box: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12 },
  mono: { fontFamily: 'monospace', fontSize: 12, color: '#2E4A66' },
  button: { alignSelf: 'flex-start', backgroundColor: '#0A2540', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12 },
  buttonText: { color: '#FFFFFF', fontWeight: '600' },
});
