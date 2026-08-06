/**
 * Button — primary action surface. Reanimated press-scale (native thread, no JS
 * jank), light haptic on press, loading + disabled states, optional Ionicon.
 */
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/lib/theme/ThemeProvider';
import { FontSize, FontWeight, Radius, Spacing } from '@/lib/theme/tokens';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'success' | 'danger' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  haptic?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  disabled,
  haptic = true,
  fullWidth,
  style,
}: ButtonProps) {
  const { palette } = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const filled =
    variant === 'primary'
      ? palette.primary
      : variant === 'secondary'
        ? palette.secondary
        : variant === 'success'
          ? palette.success
          : variant === 'danger'
            ? palette.danger
            : null;
  const isOutline = variant === 'outline';
  const fg = filled ? palette.primaryForeground : isOutline ? palette.foreground : palette.primary;
  const height = size === 'lg' ? 56 : size === 'sm' ? 38 : 48;
  const isDisabled = disabled || loading;
  const radius = Radius.md;

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={isDisabled}
      onPressIn={() => {
        scale.value = withTiming(0.96, { duration: 80 });
        if (haptic) Haptics.selectionAsync().catch(() => {});
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 120 });
      }}
      style={[
        styles.base,
        {
          height,
          paddingHorizontal: size === 'lg' ? Spacing.xl : Spacing.lg,
          backgroundColor: filled ?? (isOutline ? palette.field : 'transparent'),
          borderColor: isOutline ? palette.borderStrong : 'transparent',
          borderWidth: isOutline ? StyleSheet.hairlineWidth : 0,
          opacity: isDisabled ? 0.55 : 1,
          width: fullWidth ? '100%' : undefined,
          // `shadow-[0_6px_18px_-6px_var(--primary)]` — the accent glow that keeps a
          // filled action from reading as a flat rectangle on a light backdrop.
          boxShadow: filled && !isDisabled ? [{ offsetX: 0, offsetY: 6, blurRadius: 18, spreadDistance: -6, color: filled }] : undefined,
        },
        animatedStyle,
        style,
      ]}
    >
      {/* `bg-gradient-to-b from-primary to-primary-hover`. The gradient carries its
          own radius so the button needs no `overflow: 'hidden'`, which would clip
          the glow above. */}
      {variant === 'primary' ? (
        <LinearGradient
          colors={[palette.primary, palette.primaryHover]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={size === 'lg' ? 22 : 18} color={fg} /> : null}
          <Text
            style={{ color: fg, fontSize: size === 'lg' ? FontSize.lg : FontSize.md, fontWeight: FontWeight.bold }}
          >
            {title}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
