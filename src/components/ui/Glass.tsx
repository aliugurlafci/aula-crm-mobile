/**
 * Cross-platform frosted-glass surface — the core of the glassmorphism look.
 *
 *  - iOS 26+ (Liquid Glass available): native `GlassView`.
 *  - everything else: `expo-blur` `BlurView` (dimezisBlurViewSdk31Plus on Android
 *    SDK 31+, graceful semi-transparent fallback below) with a translucent tint
 *    overlay + hairline border matching the web `--glass-*` tokens.
 *
 * It blurs whatever sits behind it in the view tree, so place it over the
 * ScreenBackground's aurora blobs for the frosted effect.
 */
import { Platform, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

import { useTheme } from '@/lib/theme/ThemeProvider';
import { GlassBlur, Radius } from '@/lib/theme/tokens';

const LIQUID_GLASS = Platform.OS === 'ios' && safeLiquidGlass();

function safeLiquidGlass(): boolean {
  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

export interface GlassProps extends ViewProps {
  /** Stronger, more opaque surface (e.g. sticky bars, modals). */
  strong?: boolean;
  radius?: number;
  intensity?: number;
  bordered?: boolean;
}

export function Glass({ strong, radius = Radius.lg, intensity, bordered = true, style, children, ...rest }: GlassProps) {
  const { palette, scheme } = useTheme();

  const frame: ViewStyle = {
    borderRadius: radius,
    overflow: 'hidden',
    borderWidth: bordered ? StyleSheet.hairlineWidth : 0,
    borderColor: palette.glassBorder,
  };

  if (LIQUID_GLASS) {
    // `colorScheme` asks the native glass to follow our in-app theme toggle
    // instead of the OS appearance (default 'auto'). We ALSO overlay the palette
    // glass fill (same as the BlurView path) so surfaces visibly adopt the
    // selected light/dark theme even on native builds that don't yet honour
    // `colorScheme`. The overlay is absolute-fill so it never affects layout, and
    // children render directly so the caller's layout style (e.g. the tab bar's
    // flexDirection:'row') applies.
    return (
      <GlassView glassEffectStyle="regular" colorScheme={scheme} style={[frame, style]} {...rest}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: strong ? palette.glassBgStrong : palette.glassBg }]} />
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView
      intensity={intensity ?? GlassBlur[scheme]}
      tint={palette.blurTint}
      experimentalBlurMethod="dimezisBlurView"
      style={[frame, style]}
      {...rest}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: strong ? palette.glassBgStrong : palette.glassBg }]} />
      {children}
    </BlurView>
  );
}
