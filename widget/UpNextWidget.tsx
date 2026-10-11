import { FlexWidget, TextWidget } from 'react-native-android-widget';

export interface WidgetRow {
  showId: string;
  episodeId: number;
  uri: string;
  title: string;
  detail: string;
}

type Colors = { bg: `#${string}`; card: `#${string}`; ink: `#${string}`; soft: `#${string}`; accent: `#${string}`; onAccent: `#${string}` };
const LIGHT: Colors = { bg: '#F4F8FC', card: '#FFFFFF', ink: '#0A2540', soft: '#5B6B7F', accent: '#3987E5', onAccent: '#FFFFFF' };
const DARK: Colors = { bg: '#0B1622', card: '#13202E', ink: '#EAF3FB', soft: '#93A4B8', accent: '#5A9CEB', onAccent: '#061423' };

/** Up next on the home screen: the next episode of each show you're watching, one tick to mark it. */
export function UpNextWidget({ rows, title, empty, dark, accent }: { rows: WidgetRow[]; title: string; empty: string; dark: boolean; accent?: string }) {
  const c = { ...(dark ? DARK : LIGHT), ...(accent && /^#[0-9a-f]{6}$/i.test(accent) ? { accent: accent as `#${string}` } : {}) };
  return (
    <FlexWidget style={{ height: 'match_parent', width: 'match_parent', backgroundColor: c.bg, borderRadius: 22, padding: 12, flexDirection: 'column' }} clickAction="OPEN_APP">
      <TextWidget text={title} style={{ fontSize: 15, fontWeight: '700', color: c.ink, marginBottom: 8, marginLeft: 4 }} />
      {rows.length === 0 ? (
        <TextWidget text={empty} style={{ fontSize: 13, color: c.soft, marginLeft: 4 }} />
      ) : (
        rows.map((r) => (
          <FlexWidget
            key={r.showId}
            style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 14, paddingVertical: 8, paddingLeft: 12, paddingRight: 8, marginBottom: 6 }}
            clickAction="OPEN_URI"
            clickActionData={{ uri: r.uri }}
          >
            <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
              <TextWidget text={r.title} maxLines={1} truncate="END" style={{ fontSize: 14, fontWeight: '600', color: c.ink }} />
              <TextWidget text={r.detail} maxLines={1} truncate="END" style={{ fontSize: 12, color: c.soft }} />
            </FlexWidget>
            <FlexWidget
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}
              clickAction="TICK"
              clickActionData={{ showId: r.showId, episodeId: r.episodeId }}
              accessibilityLabel={`${r.title} ${r.detail}`}
            >
              <TextWidget text="✓" style={{ fontSize: 18, fontWeight: '700', color: c.onAccent }} />
            </FlexWidget>
          </FlexWidget>
        ))
      )}
    </FlexWidget>
  );
}
