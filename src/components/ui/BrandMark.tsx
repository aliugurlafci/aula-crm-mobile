/**
 * Aula brand mark — an isometric stock crate (three seam-split faces) with the
 * ascending stock-level bars on its shadow face. Same geometry as the app icon
 * (`assets/images/icon.png`) and the web `BrandMark`; keep them in sync if the
 * shape ever changes.
 *
 * The side faces are derived from the theme's `primary` so the mark tracks the
 * light/dark palette instead of hard-coding the accent.
 */
import { View, type ViewStyle } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

import { useTheme } from '@/lib/theme/ThemeProvider';

/** Face outlines, inset so the round-join stroke lands exactly on the seam. */
const TOP = 'M50 16.975L74.045 30.5L50 44.025L25.955 30.5Z';
const LEFT = 'M21.9 37.168L46.1 50.781L46.1 80.832L21.9 67.219Z';
const RIGHT = 'M53.9 50.781L78.1 37.168L78.1 67.219L53.9 80.832Z';
const BARS = [
  'M55.72 67.39L59.96 65.005L59.96 73.409L55.72 75.794Z',
  'M64.04 58.077L68.28 55.692L68.28 68.729L64.04 71.114Z',
  'M72.36 48.763L76.6 46.378L76.6 64.049L72.36 66.434Z',
];

/** Blend `hex` toward white (t > 0) or black (t < 0) — the crate's lit/shadow faces. */
function shade(hex: string, t: number): string {
  const v = hex.replace('#', '');
  const full = v.length === 3 ? v.split('').map((c) => c + c).join('') : v;
  const to = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  const ch = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16);
    return Math.round(c + (to - c) * k);
  });
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export function BrandMark({ size = 40, bars = true, style }: { size?: number; bars?: boolean; style?: ViewStyle }) {
  const { palette } = useTheme();
  const p = palette.primary;
  return (
    <View style={style}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="am-top" x1="18" y1="12" x2="82" y2="49" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#ffffff" />
            <Stop offset="1" stopColor="#ffd9d2" />
          </LinearGradient>
          <LinearGradient id="am-left" x1="18" y1="31" x2="50" y2="88" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={shade(p, 0.2)} />
            <Stop offset="1" stopColor={p} />
          </LinearGradient>
          <LinearGradient id="am-right" x1="82" y1="31" x2="50" y2="88" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={shade(p, -0.16)} />
            <Stop offset="1" stopColor={shade(p, -0.42)} />
          </LinearGradient>
          <LinearGradient id="am-bar" x1="50" y1="80" x2="82" y2="34" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.45" />
            <Stop offset="1" stopColor="#ffffff" stopOpacity="0.92" />
          </LinearGradient>
        </Defs>
        {/* Fill + same-paint round-join stroke is what rounds the crate's corners. */}
        <G>
          <Path d={TOP} fill="url(#am-top)" stroke="url(#am-top)" strokeWidth={5} strokeLinejoin="round" />
          <Path d={LEFT} fill="url(#am-left)" stroke="url(#am-left)" strokeWidth={5} strokeLinejoin="round" />
          <Path d={RIGHT} fill="url(#am-right)" stroke="url(#am-right)" strokeWidth={5} strokeLinejoin="round" />
          {bars
            ? BARS.map((d) => (
                <Path key={d} d={d} fill="url(#am-bar)" stroke="url(#am-bar)" strokeWidth={1.6} strokeLinejoin="round" />
              ))
            : null}
        </G>
      </Svg>
    </View>
  );
}
