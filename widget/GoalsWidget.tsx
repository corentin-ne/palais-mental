import { FlexWidget, TextWidget } from 'react-native-android-widget';

export interface GoalRow {
  label: string;
  count: number;
  goal: number;
}

type Colors = { bg: `#${string}`; track: `#${string}`; ink: `#${string}`; soft: `#${string}`; accent: `#${string}`; done: `#${string}` };
const LIGHT: Colors = { bg: '#F4F8FC', track: '#E1E9F2', ink: '#0A2540', soft: '#5B6B7F', accent: '#3987E5', done: '#1F9D63' };
const DARK: Colors = { bg: '#0B1622', track: '#1D2B3B', ink: '#EAF3FB', soft: '#93A4B8', accent: '#5A9CEB', done: '#3CC184' };

/** This year's goals on the home screen: films, books and games, each with its bar. */
export function GoalsWidget({ rows, title, empty, dark, accent, width }: { rows: GoalRow[]; title: string; empty: string; dark: boolean; accent?: string; width: number }) {
  const c = { ...(dark ? DARK : LIGHT), ...(accent && /^#[0-9a-f]{6}$/i.test(accent) ? { accent: accent as `#${string}` } : {}) };
  // The bar's length in dp: the widget's width less its padding.
  const bar = Math.max(60, width - 32);
  return (
    <FlexWidget style={{ height: 'match_parent', width: 'match_parent', backgroundColor: c.bg, borderRadius: 22, padding: 16, flexDirection: 'column' }} clickAction="OPEN_URI" clickActionData={{ uri: 'palaismental://stats' }}>
      <TextWidget text={title} style={{ fontSize: 15, fontWeight: '700', color: c.ink, marginBottom: 10 }} />
      {rows.length === 0 ? (
        <TextWidget text={empty} style={{ fontSize: 13, color: c.soft }} />
      ) : (
        rows.map((r) => {
          const done = r.count >= r.goal;
          const fill = Math.max(4, Math.round(bar * Math.min(1, r.count / r.goal)));
          return (
            <FlexWidget key={r.label} style={{ width: 'match_parent', flexDirection: 'column', marginBottom: 10 }}>
              <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <TextWidget text={r.label} style={{ fontSize: 13, fontWeight: '600', color: c.ink }} />
                <TextWidget text={`${r.count} / ${r.goal}`} style={{ fontSize: 13, fontWeight: '600', color: done ? c.done : c.soft }} />
              </FlexWidget>
              <FlexWidget style={{ width: bar, height: 6, borderRadius: 3, backgroundColor: c.track }}>
                <FlexWidget style={{ width: fill, height: 6, borderRadius: 3, backgroundColor: done ? c.done : c.accent }} />
              </FlexWidget>
            </FlexWidget>
          );
        })
      )}
    </FlexWidget>
  );
}
