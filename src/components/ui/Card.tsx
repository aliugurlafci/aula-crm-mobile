/**
 * Glass card — the default content surface. Thin wrapper over Glass that adds
 * padding and the `--shadow-glass` drop shadow.
 *
 * The shadow lives on an outer view rather than on the Glass itself: Glass needs
 * `overflow: 'hidden'` to clip its fill to the corner radius, and on iOS that sets
 * `clipsToBounds`, which clips the layer shadow away too. With both on one node a
 * card rendered completely flat — invisible in light mode, where the shadow is the
 * only thing separating a near-white surface from a near-white backdrop.
 *
 * The caller's `style` is applied to the Glass, which now holds the children
 * directly, so content layout (`gap`, `alignItems`, `flexDirection`) reaches the
 * box it is written for.
 */
import { StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/lib/theme/ThemeProvider';
import { GlassShadow, Radius, Spacing } from '@/lib/theme/tokens';
import { Glass } from './Glass';

export interface CardProps extends ViewProps {
  padded?: boolean;
  strong?: boolean;
  radius?: number;
}

export function Card({ padded = true, strong, radius = Radius.lg, style, children, ...rest }: CardProps) {
  const { palette } = useTheme();
  return (
    <View style={{ borderRadius: radius, boxShadow: [{ ...GlassShadow, color: palette.shadow }] }}>
      <Glass strong={strong} radius={radius} style={[padded ? styles.padded : null, style]} {...rest}>
        {children}
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  padded: { padding: Spacing.lg },
});
