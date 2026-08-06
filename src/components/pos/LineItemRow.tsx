/**
 * A single sale line (POS / Cart / Returns): description, unit price, quantity
 * stepper, line total and remove. Optional low-stock warning badge.
 *
 * `readOnly` renders the same row without the stepper or remove control — used
 * for a basket the viewer may look at but not change (e.g. a cart already at the
 * register), so settled and editable baskets keep an identical line shape.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/lib/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n/LanguageProvider';
import { Spacing } from '@/lib/theme/tokens';
import { lineGross, money } from '@/lib/format';
import type { SaleLine } from '@/lib/types';
import { Text } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { QtyStepper } from '@/components/ui/QtyStepper';

function LineItemRowBase({
  line,
  currency = 'USD',
  onQty,
  onRemove,
  stockWarning,
  readOnly = false,
}: {
  line: SaleLine;
  currency?: string;
  onQty?: (qty: number) => void;
  onRemove?: () => void;
  stockWarning?: string | null;
  readOnly?: boolean;
}) {
  const { palette } = useTheme();
  const { t } = useI18n();
  return (
    <View style={[styles.row, { borderBottomColor: palette.border }]}>
      <View style={styles.info}>
        <Text variant="body" weight="semibold" numberOfLines={2}>
          {line.description}
        </Text>
        <View style={styles.meta}>
          <Text variant="caption" tone="muted">
            {money(line.unitPrice, currency)}
            {line.taxRate ? ` · ${t('line.tax', { rate: line.taxRate })}` : ''}
          </Text>
          {stockWarning ? <Badge tone="warning" label={stockWarning} /> : null}
        </View>
      </View>
      <View style={styles.right}>
        {readOnly ? (
          <Text variant="caption" tone="muted">
            ×{line.qty}
          </Text>
        ) : (
          <QtyStepper value={line.qty} onChange={onQty ?? (() => {})} min={0} />
        )}
        <Text variant="subtitle" weight="bold" style={styles.total}>
          {money(lineGross(line), currency)}
        </Text>
      </View>
      {readOnly ? null : <IconButton icon="trash-outline" size={34} tint="danger" onPress={onRemove} />}
    </View>
  );
}

/**
 * Rows re-render only when their own data changes.
 *
 * The screens hosting these rows re-render on every keystroke in the scan box, so
 * without this a 30-line basket re-rendered 30 rows per character. The callbacks
 * are deliberately left out of the comparison: each one closes over a stable
 * `useSaleCart` setter plus the row's own `line.key`, so an older closure does
 * exactly what a fresh one would — while `line` itself keeps its identity for
 * untouched rows (the hook only rebuilds the entry it changes).
 */
export const LineItemRow = memo(
  LineItemRowBase,
  (prev, next) =>
    prev.line === next.line &&
    prev.currency === next.currency &&
    prev.readOnly === next.readOnly &&
    prev.stockWarning === next.stockWarning,
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  info: { flex: 1, gap: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  right: { alignItems: 'flex-end', gap: Spacing.xs },
  total: { minWidth: 72, textAlign: 'right' },
});
