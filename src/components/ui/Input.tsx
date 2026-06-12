/**
 * Text input on a glass field. Optional leading icon, label, error message, and
 * a right-side adornment (e.g. a scan button).
 */
import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/lib/theme/ThemeProvider';
import { FontSize, Radius, Spacing } from '@/lib/theme/tokens';
import { Text } from './Text';

export interface InputProps extends TextInputProps {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string | null;
  right?: React.ReactNode;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, icon, error, right, style, ...rest },
  ref,
) {
  const { palette } = useTheme();
  return (
    <View style={{ gap: Spacing.xs }}>
      {label ? (
        <Text variant="label" tone="muted">
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          {
            backgroundColor: palette.surface2,
            borderColor: error ? palette.danger : palette.border,
          },
        ]}
      >
        {icon ? <Ionicons name={icon} size={18} color={palette.muted} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={palette.muted2}
          style={[styles.input, { color: palette.foreground }, style]}
          {...rest}
        />
        {right}
      </View>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
  },
  input: { flex: 1, fontSize: FontSize.md, paddingVertical: Spacing.md },
});
