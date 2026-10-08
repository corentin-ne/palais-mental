# Spark UI kit · native (React Native / Expo)

The kit's look on a phone: the same tokens, rules and components as the web kit, built for touch.
First used by Palais Mental 1.4.

## Use it

Each app keeps its own copy, as with the web kit: copy `native/` into the app (for example as `spark/`)
and note the kit version you copied. Peer dependencies: `react`, `react-native`, `react-native-svg`,
`expo-blur`, `expo-linear-gradient`.

```tsx
import { Aurora, Button, Card, SparkProvider, sparkStyles, useSpark } from './spark';

export default function App() {
  return (
    <SparkProvider scheme="dark" accent="#3987e5" lite={false}>
      <View style={{ flex: 1 }}>
        <Aurora />
        <Card title="Watching" icon="tv">
          <Button label="Continue" variant="primary" icon="play" onPress={…} block />
        </Card>
      </View>
    </SparkProvider>
  );
}

const useStyles = sparkStyles((t) => ({ title: { ...t.type.section, color: t.color.textPrimary } }));
```

`useSpark()` gives the tokens; `sparkStyles()` builds a StyleSheet once per token set (theme × accent ×
quality), never on every render. `tokensFor()` / `createTokens()` give the same tokens outside React.

## Tokens (`tokens.ts`)

Everything in `css/foundation/tokens.css`, in camelCase (`--glass-border-strong` → `color.glassBorderStrong`),
built from three inputs: the theme, the accent and the display quality (plus more contrast and reduced motion).

- **Accent family**: `accent`, `accent2` (+38° hue), `accent3` (−70°), `accentSoft`, `accentRing`, `accentGlow`,
  `onAccent` (white, or near-black on light accents), `accentText` (clamped for AA on glass), `primaryGradient`,
  `aurora`. React Native has no `color-mix()` or relative colours: `color.ts` does the same maths in OKLab /
  OKLCH, so an amber or lime accent gets dark text on its buttons exactly as on the web.
- **Data and states** (`series`, `good` / `warning` / `serious` / `critical` with `*Text` and `*Soft`) never
  follow the accent.
- **Lite** (`lite: true`): opaque glass, no blur, short shadows, no glow, no looping animation.
  **More contrast**: opaque glass, firmer borders and secondary text. **Reduced motion**: 1 ms durations, no loops.

## Phone rules (what changes from the web)

| Web | Phone |
| --- | --- |
| Targets ≥ 24 px (WCAG floor), buttons 38 / 32 / 26 px | Targets 44 pt; controls `lg` 50 (main action), `md` 44, `sm` 36, `xs` 30 inside a 44 hit area |
| Body 14, section 17, card 15, page title 30 | Body 15, section 20, card 16, page title 30: read at arm's length |
| Segoe UI Variable, `system-ui` fallbacks | System fonts (SF Pro, Roboto): nothing to load at start |
| Every glass panel blurs what is behind it | **Blur only floating layers** (tab bar, top bar, sheets, toasts). Cards in a scrolling screen are translucent glass without blur: one blur per card costs a GPU pass per card on every scroll frame |
| Aurora on `body::before`, grain on `body::after` | `<Aurora />` first in each screen (static SVG radial washes); no grain |
| Hover lift, pointer rim light, press ripple | No hover on touch: press = spring to 0.97, primary buttons get the light sweep on press |
| Segmented control: inline, hugs its labels | Full width, equal segments, the thumb slides |
| Sidebar, menus, nav items | Tab bar; `ListRow` groups in a `Glass` (52 pt rows, chevron, hairline separators) |
| Two buttons side by side | Two labelled actions stacked, the main one first, when they don't fit |
| `:focus-visible` ring | The platform's focus; screen reader roles and states on every control |

## Components

| Element | API | File |
| --- | --- | --- |
| Aurora backdrop | `<Aurora />` | `surfaces.tsx` |
| Glass | `<Glass tone="default\|strong\|subtle" blur elevated radius>` | `surfaces.tsx` |
| Press feedback | `<Press depth onPress>`: Pressable + spring scale | `surfaces.tsx` |
| Icons | `<Icon name size color filled label />`, `addIcons()`, `iconNames()`: the web icon set, generated into `icons.generated.ts` by `tools/build.py` | `Icon.tsx` |
| Buttons | `<Button variant="primary\|secondary\|ghost\|danger\|dangerSolid\|success" size="lg\|md\|sm\|xs" icon iconOnly busy block />` | `controls.tsx` |
| Chips | `<Chip label active count icon critical />`, `<ChipRow inset>` | `controls.tsx` |
| Segmented | `<Segmented value options onChange />` | `controls.tsx` |
| Switch | `<Switch value onValueChange label />` | `controls.tsx` |
| Card | `<Card title subtitle icon actions onPress compact>` | `display.tsx` |
| Section head, eyebrow | `<SectionHead title eyebrow count action />`, `<Eyebrow accent>` | `display.tsx` |
| Badge, status dot | `<Badge label tone dot icon />`, `<StatusDot level />` (colour and shape) | `display.tsx` |
| Stat tile, meter | `<Tile label value unit sub icon tone />`, `<Meter value color />` | `display.tsx` |
| Feedback | `<Skeleton>`, `<Spinner>`, `<EmptyState icon title body action />`, `<Alert tone icon>` | `display.tsx` |
| Toast | `<ToastCard message detail level action progress />` (the app owns the queue and timing) | `display.tsx` |
| List row | `<ListRow title detail icon accentIcon trailing onPress danger first />` | `display.tsx` |
| Text field | `<Field icon invalid … TextInput props />` | `display.tsx` |

## Maintenance

- A token or rule changes on the web: carry it into `tokens.ts` in the same commit (same names).
- Icons: edit `js/components/icons.js`, run `python tools/build.py` (writes `native/icons.generated.ts`).
- Check: copy into an app and run its typecheck; look at dark, light, lite and a light accent (amber).
