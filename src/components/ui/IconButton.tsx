/**
 * Circular glass icon button (headers, list-row actions, qty steppers).
 */
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/lib/theme/ThemeProvider';

export interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  size?: number;
  color?: string;
  tint?: 'surface' | 'primary' | 'danger' | 'transparent';
  disabled?: boolean;
  style?: ViewStyle;
}

export function IconButton({ icon, onPress, size = 40, color, tint = 'surface', disabled, style }: IconButtonProps) {
  const { palette } = useTheme();
  const bg =
    tint === 'primary'
      ? palette.primary
      : tint === 'danger'
        ? palette.danger + '22'
        : tint === 'transparent'
          ? 'transparent'
          : palette.surface2;
  const fg = color ?? (tint === 'primary' ? palette.primaryForeground : tint === 'danger' ? palette.danger : palette.foreground);
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          borderColor: palette.border,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={size * 0.5} color={fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
});
