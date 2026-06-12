/** − value + stepper for line quantities. */
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/lib/theme/ThemeProvider';
import { Radius, Spacing } from '@/lib/theme/tokens';
import { qty as fmtQty } from '@/lib/format';
import { IconButton } from './IconButton';
import { Text } from './Text';

export function QtyStepper({
  value,
  onChange,
  min = 0,
  step = 1,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  step?: number;
}) {
  const { palette } = useTheme();
  return (
    <View style={[styles.row, { borderColor: palette.border }]}>
      <IconButton icon="remove" size={32} onPress={() => onChange(Math.max(min, value - step))} />
      <Text variant="subtitle" weight="bold" style={styles.value}>
        {fmtQty(value)}
      </Text>
      <IconButton icon="add" size={32} tint="primary" onPress={() => onChange(value + step)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  value: { minWidth: 36, textAlign: 'center' },
});
