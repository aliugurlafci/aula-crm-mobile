/**
 * Small pill badge for status (stock level, sync state, sale status, role).
 */
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/lib/theme/ThemeProvider';
import { FontWeight, Radius } from '@/lib/theme/tokens';
import { Text } from './Text';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<BadgeTone, 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'muted'> = {
  neutral: 'muted',
  primary: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
};

export function Badge({ label, tone = 'neutral', style }: { label: string; tone?: BadgeTone; style?: ViewStyle }) {
  const { palette } = useTheme();
  const color =
    tone === 'success'
      ? palette.success
      : tone === 'warning'
        ? palette.warning
        : tone === 'danger'
          ? palette.danger
          : tone === 'info'
            ? palette.info
            : tone === 'primary'
              ? palette.primary
              : palette.muted;
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color + '55' }, style]}>
      <Text variant="caption" tone={TONES[tone]} style={{ fontWeight: FontWeight.bold }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
