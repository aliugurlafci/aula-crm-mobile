/**
 * Inline status banner (info / success / warning / danger) — used for offline
 * notices, sync results and form errors.
 */
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/lib/theme/ThemeProvider';
import { Radius, Spacing } from '@/lib/theme/tokens';
import { Text } from './Text';

type Tone = 'info' | 'success' | 'warning' | 'danger';

const ICONS: Record<Tone, keyof typeof Ionicons.glyphMap> = {
  info: 'information-circle',
  success: 'checkmark-circle',
  warning: 'warning',
  danger: 'alert-circle',
};

export function Banner({ tone = 'info', title, message }: { tone?: Tone; title?: string; message: string }) {
  const { palette } = useTheme();
  const color =
    tone === 'success' ? palette.success : tone === 'warning' ? palette.warning : tone === 'danger' ? palette.danger : palette.info;
  return (
    <View style={[styles.root, { backgroundColor: color + '1A', borderColor: color + '44' }]}>
      <Ionicons name={ICONS[tone]} size={20} color={color} />
      <View style={styles.text}>
        {title ? (
          <Text variant="label" style={{ color }}>
            {title}
          </Text>
        ) : null}
        <Text variant="caption" tone="muted">
          {message}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, gap: 2 },
});
