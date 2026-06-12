/**
 * Themed text. Variants map to the type scale in tokens.ts; `tone` picks a
 * palette color. Keeps every screen's typography consistent with the web app.
 */
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/lib/theme/ThemeProvider';
import { FontSize, FontWeight } from '@/lib/theme/tokens';

type Variant = 'display' | 'title' | 'heading' | 'subtitle' | 'body' | 'label' | 'caption' | 'mono';
type Tone = 'default' | 'muted' | 'muted2' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'inverse';

export interface TextProps extends RNTextProps {
  variant?: Variant;
  tone?: Tone;
  weight?: keyof typeof FontWeight;
  center?: boolean;
}

const VARIANTS: Record<Variant, TextStyle> = {
  display: { fontSize: FontSize.display, fontWeight: FontWeight.heavy, letterSpacing: -0.5 },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, letterSpacing: -0.3 },
  heading: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  subtitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  body: { fontSize: FontSize.md, fontWeight: FontWeight.regular },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  caption: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  mono: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, fontFamily: 'monospace' },
};

export function Text({ variant = 'body', tone = 'default', weight, center, style, ...rest }: TextProps) {
  const { palette } = useTheme();
  const color =
    tone === 'muted'
      ? palette.muted
      : tone === 'muted2'
        ? palette.muted2
        : tone === 'primary'
          ? palette.primary
          : tone === 'success'
            ? palette.success
            : tone === 'warning'
              ? palette.warning
              : tone === 'danger'
                ? palette.danger
                : tone === 'info'
                  ? palette.info
                  : tone === 'inverse'
                    ? palette.primaryForeground
                    : palette.foreground;
  return (
    <RNText
      {...rest}
      style={[
        VARIANTS[variant],
        { color },
        weight ? { fontWeight: FontWeight[weight] } : null,
        center ? { textAlign: 'center' } : null,
        style,
      ]}
    />
  );
}
