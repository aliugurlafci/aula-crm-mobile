/**
 * Full-screen backdrop: a soft vertical gradient (the web `--background` →
 * `--background-2`) with three decorative aurora blobs (`--aurora-*`) behind the
 * content. Glass surfaces placed on top blur these blobs for the frosted look.
 *
 * The web draws the blobs as `radial-gradient(… , var(--aurora-1), transparent
 * 60%)` — colour at the centre fading to nothing well before the edge. React
 * Native has no radial gradient, and a flat disc of the token colour instead of a
 * falloff is what made the backdrop read as flat: a hard-edged pale patch in light
 * mode rather than a wash of colour. Each blob is therefore a stack of concentric
 * circles at a fraction of the token alpha, which accumulate towards the centre and
 * approximate the falloff. Alpha steps land ~3% apart, below the banding threshold.
 *
 * Blobs are sized and placed relative to the window (as the web's rem sizes and
 * percentage positions are relative to the viewport), so they hold their proportion
 * on a tablet or in landscape instead of shrinking into small dots.
 */
import { StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/lib/theme/ThemeProvider';

/** Ring diameters as a fraction of the blob box, outermost first. */
const RINGS = [1, 0.8, 0.6, 0.42, 0.26] as const;
/** Per-ring share of the token alpha; the stack composites back to roughly it. */
const RING_ALPHA = 0.22;

/** The same colour with its alpha scaled — how the rings build up the falloff. */
function scaleAlpha(color: string, factor: number): string {
  const parts = /^rgba?\(([^)]+)\)$/.exec(color)?.[1].split(',');
  if (!parts || parts.length < 3) return color;
  const [r, g, b, a = '1'] = parts.map((s) => s.trim());
  return `rgba(${r},${g},${b},${(Number(a) * factor).toFixed(4)})`;
}

function Aurora({ color, size, style }: { color: string; size: number; style: ViewStyle }) {
  const ring = scaleAlpha(color, RING_ALPHA);
  return (
    <View style={[styles.aurora, { width: size, height: size }, style]}>
      {RINGS.map((scale) => (
        <View
          key={scale}
          style={{
            position: 'absolute',
            width: size * scale,
            height: size * scale,
            borderRadius: (size * scale) / 2,
            backgroundColor: ring,
          }}
        />
      ))}
    </View>
  );
}

export function ScreenBackground({ children }: { children: React.ReactNode }) {
  const { palette } = useTheme();
  const { width, height } = useWindowDimensions();

  // Centres mirror the web mesh: red top-left (12%, -8%), violet off the right
  // edge (108%, 8%), blue below the bottom-right (78%, 112%).
  const blobs = [
    { color: palette.aurora1, size: width * 1.05, cx: width * 0.12, cy: height * -0.08 },
    { color: palette.aurora2, size: width * 0.95, cx: width * 1.04, cy: height * 0.09 },
    { color: palette.aurora3, size: width * 1.0, cx: width * 0.78, cy: height * 1.08 },
  ];

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[palette.background, palette.background2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {blobs.map((b) => (
          <Aurora
            key={b.color}
            color={b.color}
            size={b.size}
            style={{ left: b.cx - b.size / 2, top: b.cy - b.size / 2 }}
          />
        ))}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  aurora: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
