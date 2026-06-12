/**
 * A single sale line (POS / Cart / Returns): description, unit price, quantity
 * stepper, line total and remove. Optional low-stock warning badge.
 */
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/lib/theme/ThemeProvider';
import { Spacing } from '@/lib/theme/tokens';
import { lineGross, money } from '@/lib/format';
import type { SaleLine } from '@/lib/types';
import { Text } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { QtyStepper } from '@/components/ui/QtyStepper';

export function LineItemRow({
  line,
  currency = 'USD',
  onQty,
  onRemove,
  stockWarning,
}: {
  line: SaleLine;
  currency?: string;
  onQty: (qty: number) => void;
  onRemove: () => void;
  stockWarning?: string | null;
}) {
  const { palette } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: palette.border }]}>
      <View style={styles.info}>
        <Text variant="body" weight="semibold" numberOfLines={2}>
          {line.description}
        </Text>
        <View style={styles.meta}>
          <Text variant="caption" tone="muted">
            {money(line.unitPrice, currency)}
            {line.taxRate ? ` · +${line.taxRate}% tax` : ''}
          </Text>
          {stockWarning ? <Badge tone="warning" label={stockWarning} /> : null}
        </View>
      </View>
      <View style={styles.right}>
        <QtyStepper value={line.qty} onChange={onQty} min={0} />
        <Text variant="subtitle" weight="bold" style={styles.total}>
          {money(lineGross(line), currency)}
        </Text>
      </View>
      <IconButton icon="trash-outline" size={34} tint="danger" onPress={onRemove} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  info: { flex: 1, gap: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  right: { alignItems: 'flex-end', gap: Spacing.xs },
  total: { minWidth: 72, textAlign: 'right' },
});
