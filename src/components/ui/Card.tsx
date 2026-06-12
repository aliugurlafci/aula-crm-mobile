/**
 * Glass card — the default content surface. Thin wrapper over Glass with
 * sensible padding + shadow tuned per scheme.
 */
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/lib/theme/ThemeProvider';
import { Radius, Spacing } from '@/lib/theme/tokens';
import { Glass } from './Glass';

export interface CardProps extends ViewProps {
  padded?: boolean;
  strong?: boolean;
  radius?: number;
}

export function Card({ padded = true, strong, radius = Radius.lg, style, children, ...rest }: CardProps) {
  const { isDark } = useTheme();
  return (
    <Glass strong={strong} radius={radius} style={[styles.shadow, isDark ? styles.shadowDark : styles.shadowLight, style]} {...rest}>
      <View style={padded ? styles.padded : undefined}>{children}</View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  padded: { padding: Spacing.lg },
  shadow: Platform.select({
    ios: { shadowOffset: { width: 0, height: 10 }, shadowRadius: 24 },
    default: { elevation: 4 },
  }) as object,
  shadowLight: Platform.select({ ios: { shadowColor: '#0f172a', shadowOpacity: 0.14 }, default: {} }) as object,
  shadowDark: Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.5 }, default: {} }) as object,
});
