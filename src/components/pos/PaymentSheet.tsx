/**
 * Shared tender sheet for POS + cart checkout: pick a method (cash/card/other),
 * enter the cash tendered on the on-screen numpad with quick-cash chips, see the
 * change, and confirm. Reports the payment + change to the caller.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/lib/theme/ThemeProvider';
import { Radius, Spacing } from '@/lib/theme/tokens';
import { money, round2 } from '@/lib/format';
import type { Payment, PaymentMethod } from '@/lib/types';
import { Sheet } from '@/components/ui/Sheet';
import { Numpad } from '@/components/ui/Numpad';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';

const METHODS: { key: PaymentMethod; label: string }[] = [
  { key: 'cash', label: 'Cash' },
  { key: 'card', label: 'Card' },
  { key: 'other', label: 'Other' },
];

export function PaymentSheet({
  visible,
  total,
  currency = 'USD',
  busy,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  total: number;
  currency?: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (payment: Payment, change: number) => void;
}) {
  const { palette } = useTheme();
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [tendered, setTendered] = useState('');

  useEffect(() => {
    if (visible) {
      setMethod('cash');
      setTendered('');
    }
  }, [visible]);

  const tenderedNum = round2(Number(tendered) || 0);
  const change = method === 'cash' ? Math.max(0, round2(tenderedNum - total)) : 0;
  const shortfall = method === 'cash' && tenderedNum > 0 && tenderedNum < total;
  const quick = quickCashOptions(total);

  const confirm = () => {
    const amount = method === 'cash' ? (tenderedNum > 0 ? tenderedNum : total) : total;
    onConfirm({ method, amount }, change);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`Charge ${money(total, currency)}`}>
      <View style={styles.methods}>
        {METHODS.map((m) => {
          const active = method === m.key;
          return (
            <Pressable
              key={m.key}
              onPress={() => setMethod(m.key)}
              style={[
                styles.method,
                { borderColor: active ? palette.primary : palette.border, backgroundColor: active ? palette.primary + '18' : 'transparent' },
              ]}
            >
              <Text variant="label" tone={active ? 'primary' : 'muted'}>
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {method === 'cash' ? (
        <>
          <View style={[styles.tenderRow, { borderColor: palette.border }]}>
            <Text variant="body" tone="muted">
              Tendered
            </Text>
            <Text variant="title" weight="heavy">
              {money(tenderedNum, currency)}
            </Text>
          </View>
          <View style={styles.quick}>
            {quick.map((amt) => (
              <Pressable
                key={amt}
                onPress={() => setTendered(String(amt))}
                style={[styles.quickBtn, { borderColor: palette.border, backgroundColor: palette.surface2 }]}
              >
                <Text variant="label">{money(amt, currency)}</Text>
              </Pressable>
            ))}
          </View>
          <Numpad value={tendered} onChange={setTendered} />
          <View style={styles.changeRow}>
            <Text variant="subtitle" tone="muted">
              Change
            </Text>
            <Text variant="title" weight="heavy" tone={shortfall ? 'danger' : 'success'}>
              {shortfall ? 'Short' : money(change, currency)}
            </Text>
          </View>
        </>
      ) : (
        <Text variant="body" tone="muted">
          {method === 'card' ? 'Card payment for the full balance.' : 'Other tender for the full balance.'}
        </Text>
      )}

      <Button title="Complete sale" icon="checkmark-circle" size="lg" loading={busy} onPress={confirm} />
    </Sheet>
  );
}

function quickCashOptions(total: number): number[] {
  const t = Math.max(0, round2(total));
  const set = new Set<number>([Math.ceil(t)]);
  for (const note of [5, 10, 20, 50, 100, 200]) if (note >= t) set.add(note);
  return [...set].sort((a, b) => a - b).slice(0, 4);
}

const styles = StyleSheet.create({
  methods: { flexDirection: 'row', gap: Spacing.sm },
  method: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth },
  tenderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  quick: { flexDirection: 'row', gap: Spacing.sm },
  quickBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth },
  changeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
