/** Dashboard stat tile on a glass card. Tappable when `onPress` is provided. */
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/lib/theme/ThemeProvider';
import { Spacing } from '@/lib/theme/tokens';
import { Card } from './Card';
import { Text } from './Text';

export function KpiTile({
  icon,
  label,
  value,
  tone = 'primary',
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tone?: 'primary' | 'success' | 'info' | 'warning' | 'danger';
  onPress?: () => void;
}) {
  const { palette } = useTheme();
  const color =
    tone === 'success' ? palette.success : tone === 'info' ? palette.info : tone === 'warning' ? palette.warning : tone === 'danger' ? palette.danger : palette.primary;
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && onPress ? styles.pressed : null]}
      onPress={onPress}
      disabled={!onPress}
    >
      <Card padded={false}>
        <View style={styles.inner}>
          <View style={styles.topRow}>
            <View style={[styles.iconWrap, { backgroundColor: color + '22' }]}>
              <Ionicons name={icon} size={20} color={color} />
            </View>
            {onPress ? <Ionicons name="chevron-forward" size={16} color={palette.muted2} /> : null}
          </View>
          <Text variant="title" weight="heavy" numberOfLines={1} adjustsFontSizeToFit>
            {value}
          </Text>
          <Text variant="caption" tone="muted">
            {label}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.6, transform: [{ scale: 0.98 }] },
  inner: { padding: Spacing.lg, gap: Spacing.xs },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
