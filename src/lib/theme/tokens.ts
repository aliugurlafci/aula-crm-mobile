/**
 * Design tokens ported 1:1 from the web Frontend's `globals.css` glassmorphism
 * system so the mobile app shares the exact palette (cool slate neutrals + the
 * CRMS red accent #e41f07) and frosted-glass surfaces. Light + dark variants.
 */
export type Palette = {
  background: string;
  background2: string;
  /** Translucent surface (frosted-glass fill). */
  surface: string;
  surfaceSolid: string;
  surface2: string;
  foreground: string;
  muted: string;
  muted2: string;
  border: string;
  borderStrong: string;
  /**
   * Fill + edge for inputs, selects and icon buttons — the web's
   * `bg-surface/60 border-border-strong` field. Kept separate from `surface2`
   * because on the web `--surface-2` is a *pressed/hover* tone (and the neutral
   * badge), never an idle field fill: using it as one made every field read as a
   * grey tile against a near-white card.
   */
  field: string;
  fieldBorder: string;
  /** Drop shadow behind glass surfaces — ports `--shadow-glass`. */
  shadow: string;
  primary: string;
  primaryForeground: string;
  primaryHover: string;
  secondary: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  ring: string;
  glassBg: string;
  glassBgStrong: string;
  glassBorder: string;
  glassHighlight: string;
  /** Decorative aurora blobs behind the frosted glass. */
  aurora1: string;
  aurora2: string;
  aurora3: string;
  /** Tint passed to BlurView / GlassView. */
  blurTint: 'light' | 'dark';
};

export const LightPalette: Palette = {
  background: '#eef2f9',
  background2: '#e7ecf6',
  surface: 'rgba(255,255,255,0.82)',
  surfaceSolid: '#ffffff',
  surface2: 'rgba(241,244,248,0.78)',
  foreground: '#0f172a',
  muted: '#5a6577',
  muted2: '#8a94a6',
  border: 'rgba(15,23,42,0.08)',
  borderStrong: 'rgba(15,23,42,0.16)',
  field: 'rgba(255,255,255,0.72)',
  // `border-border-strong`. On a white card the fill gives a field no contrast at
  // all (the web's doesn't either), so the edge is the only thing marking it out.
  fieldBorder: 'rgba(15,23,42,0.16)',
  shadow: 'rgba(15,23,42,0.18)',
  primary: '#e41f07',
  primaryForeground: '#ffffff',
  primaryHover: '#c81b06',
  secondary: '#6d28d9',
  success: '#16a34a',
  warning: '#f59e0b',
  danger: '#dc2626',
  info: '#2563eb',
  ring: '#e41f07',
  // Deliberately more opaque than the web's `--glass-bg` (0.62), for two reasons.
  //
  // Native blur is not CSS `backdrop-filter`: the web composites a *pure* blur
  // under white and boosts it with `saturate(140%)`, so a card ends up brighter and
  // more colourful than the backdrop. `BlurView` with `tint: 'light'` mixes in its
  // own grey vibrancy layer instead, and whatever alpha is left over shows that
  // grey — at the web's value light cards read dirtier than the near-white
  // background, i.e. grey panels on white.
  //
  // On top of that, a phone is read at arm's length in daylight, where a translucent
  // surface loses the crispness it has on a monitor. These are set high enough that
  // a card is white and the blur contributes ~4%: the frost is essentially traded
  // away in light mode so the card edge, shadow and content carry the separation.
  // Dark mode keeps its own note below.
  glassBg: 'rgba(255,255,255,0.96)',
  glassBgStrong: 'rgba(255,255,255,0.99)',
  // The web's white `--glass-border` reads as a rim only because `--shadow-glass`
  // sits right outside it. A hairline that faint is invisible on a white card, so
  // light mode uses a slate edge and keeps the white for the highlight token.
  glassBorder: 'rgba(15,23,42,0.10)',
  glassHighlight: 'rgba(255,255,255,0.85)',
  aurora1: 'rgba(228,31,7,0.16)',
  aurora2: 'rgba(109,40,217,0.14)',
  aurora3: 'rgba(37,99,235,0.12)',
  blurTint: 'light',
};

export const DarkPalette: Palette = {
  background: '#070a10',
  background2: '#0c111b',
  surface: 'rgba(20,25,35,0.72)',
  surfaceSolid: '#12161f',
  surface2: 'rgba(28,34,47,0.7)',
  foreground: '#e8ecf3',
  muted: '#9aa6b6',
  muted2: '#66727f',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',
  // Dark fields stay a touch lighter than the card they sit on — the readable
  // convention when the surface is already dark.
  field: 'rgba(28,34,47,0.7)',
  fieldBorder: 'rgba(255,255,255,0.1)',
  shadow: 'rgba(0,0,0,0.55)',
  primary: '#fb4b2a',
  primaryForeground: '#ffffff',
  primaryHover: '#ff6b4d',
  secondary: '#a78bfa',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#f04444',
  info: '#3b82f6',
  ring: '#fb4b2a',
  // Dark-mode glass fills are kept fairly opaque (and tuned to the `surface2`
  // tone the search field uses) so the bright aurora blobs behind the blur don't
  // bleed through and wash cards out — a low alpha here reads as eye-straining.
  glassBg: 'rgba(28,34,47,0.9)',
  glassBgStrong: 'rgba(20,25,35,0.95)',
  glassBorder: 'rgba(255,255,255,0.1)',
  glassHighlight: 'rgba(255,255,255,0.08)',
  aurora1: 'rgba(251,75,42,0.18)',
  aurora2: 'rgba(167,139,250,0.16)',
  aurora3: 'rgba(59,130,246,0.16)',
  blurTint: 'dark',
};

/** Spacing scale (rem-ish, in px) shared across the app. */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

/** Glass blur radius from `--glass-blur` (18px light / 20px dark). expo-blur
 *  `intensity` is 0..100; map the radius onto a pleasant intensity.
 *
 *  Light stays low on purpose: intensity also scales how much of the blur tint's
 *  grey is mixed in (see the `glassBg` note above), so a high value greys out a
 *  surface that is supposed to be the brightest thing on screen. With the light
 *  fill at 0.96 the blur is a 4% contribution, so this only needs to be enough to
 *  soften what little shows through. */
export const GlassBlur = {
  light: 14,
  dark: 55,
} as const;

/** `--shadow-glass` — the drop shadow that separates a glass surface from the
 *  backdrop. `palette.shadow` supplies the per-scheme colour. */
export const GlassShadow = { offsetX: 0, offsetY: 8, blurRadius: 32, spreadDistance: -8 } as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 34,
} as const;

export const FontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
} as const;
