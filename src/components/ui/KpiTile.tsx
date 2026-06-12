/** Dashboard stat tile on a glass card. */
import { StyleSheet, View } from 'react-native';
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
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tone?: 'primary' | 'success' | 'info' | 'warning' | 'danger';
}) {
  const { palette } = useTheme();
  const color =
    tone === 'success' ? palette.success : tone === 'info' ? palette.info : tone === 'warning' ? palette.warning : tone === 'danger' ? palette.danger : palette.primary;
  return (
    <Card style={styles.card} padded={false}>
      <View style={styles.inner}>
        <View style={[styles.iconWrap, { backgroundColor: color + '22' }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text variant="title" weight="heavy" numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        <Text variant="caption" tone="muted">
          {label}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 0 },
  inner: { padding: Spacing.lg, gap: Spacing.xs },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs },
});
