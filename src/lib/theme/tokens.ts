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
  primary: '#e41f07',
  primaryForeground: '#ffffff',
  primaryHover: '#c81b06',
  secondary: '#6d28d9',
  success: '#16a34a',
  warning: '#f59e0b',
  danger: '#dc2626',
  info: '#2563eb',
  ring: '#e41f07',
  glassBg: 'rgba(255,255,255,0.62)',
  glassBgStrong: 'rgba(255,255,255,0.82)',
  glassBorder: 'rgba(255,255,255,0.6)',
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
 *  `intensity` is 0..100; map the radius onto a pleasant intensity. */
export const GlassBlur = {
  light: 40,
  dark: 55,
} as const;

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
