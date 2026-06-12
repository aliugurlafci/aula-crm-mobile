/**
 * POS terminal (Sell). Scan or search a product → it drops into the basket →
 * tender payment → the sale is queued to the durable outbox and synced (the
 * backend rings it through invoice→send: posts GL + issues stock). Works fully
 * offline; the SyncPill shows queued sales draining when back online.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/lib/auth/AuthProvider';
import { useSync } from '@/lib/sync/SyncProvider';
import { useReference } from '@/lib/hooks/useReference';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useSaleCart } from '@/lib/hooks/useSaleCart';
import { resolveProduct } from '@/lib/pos/resolve';
import { searchProducts, onHandTotal } from '@/lib/db/products';
import { pos } from '@/lib/api/endpoints';
import type { PosCheckoutBody } from '@/lib/api/endpoints';
import { money, uid } from '@/lib/format';
import type { Payment, PosSession, Product } from '@/lib/types';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { Radius, Spacing } from '@/lib/theme/tokens';
import { Screen } from '@/components/Screen';
import { ScannerSheet } from '@/components/ScannerSheet';
import { LineItemRow } from '@/components/pos/LineItemRow';
import { PaymentSheet } from '@/components/pos/PaymentSheet';
import { Button, Card, Badge, Glass, Input, IconButton, Select, Text, EmptyState } from '@/components/ui';

const CURRENCY = 'USD';

export default function PosScreen() {
  const { palette } = useTheme();
  const { can } = useAuth();
  const { submit, online } = useSync();
  const { warehouses, branches, dealers } = useReference();
  const cart = useSaleCart();

  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [dealerId, setDealerId] = useState<string | null>(null);
  const [session, setSession] = useState<PosSession | null>(null);

  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 200);
  const [results, setResults] = useState<Product[]>([]);
  const [scanning, setScanning] = useState(false);
  const [paying, setPaying] = useState(false);
  const [stockWarn, setStockWarn] = useState<Record<string, boolean>>({});

  const canCheckout = can('pos:checkout');
  const branchId = warehouses.find((w) => w.id === warehouseId)?.branchId ?? branches[0]?.id ?? null;
  const total = cart.totals.total;

  useEffect(() => {
    if (!warehouseId && warehouses.length) setWarehouseId(warehouses[0].id);
  }, [warehouses, warehouseId]);

  const loadSession = useCallback(async () => {
    if (!online) return;
    try {
      const { session: s } = await pos.session();
      setSession(s);
    } catch {
      /* ignore */
    }
  }, [online]);
  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    let alive = true;
    if (!debounced.trim()) {
      setResults([]);
      return;
    }
    searchProducts(debounced, 8).then((r) => alive && setResults(r));
    return () => {
      alive = false;
    };
  }, [debounced]);

  const addProduct = useCallback(
    async (p: Product) => {
      cart.addProduct(p);
      setSearch('');
      setResults([]);
      const onHand = await onHandTotal(p.id);
      if (onHand <= 0) setStockWarn((w) => ({ ...w, [p.id]: true }));
    },
    [cart],
  );

  const onScan = useCallback(
    async (code: string) => {
      const { product, offline } = await resolveProduct(code);
      if (product) await addProduct(product);
      else
        Alert.alert(
          'Not found',
          offline ? `No cached product for "${code}". Connect to look it up.` : `No product matches "${code}".`,
        );
    },
    [addProduct],
  );

  const completeSale = async (payment: Payment, change: number) => {
    if (!cart.lines.length) return;
    const idem = uid('pos_');
    const body: PosCheckoutBody = {
      branchId,
      warehouseId,
      dealerId,
      sessionId: session?.id ?? null,
      currencyCode: CURRENCY,
      lines: cart.lines.map((l) => ({
        productId: l.productId,
        description: l.description,
        qty: l.qty,
        unitPrice: l.unitPrice,
        taxRate: l.taxRate,
      })),
      payments: [payment],
      idempotencyKey: idem,
    };
    await submit('pos.checkout', body, idem);
    setPaying(false);
    cart.clear();
    setStockWarn({});
    void loadSession();
    Alert.alert(
      'Sale recorded',
      `${money(total, CURRENCY)} · ${payment.method}${change > 0 ? ` · change ${money(change, CURRENCY)}` : ''}\n${
        online ? 'Posting to the server…' : 'Queued — will post when back online.'
      }`,
    );
  };

  const onShift = () => {
    if (!online) {
      Alert.alert('Offline', 'Shifts can only be opened or closed while online.');
      return;
    }
    if (session) {
      Alert.alert('Close shift', `Close shift ${session.number ?? ''}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close',
          onPress: async () => {
            await pos.closeSession(session.id, session.expectedCash ?? 0).catch(() => {});
            void loadSession();
          },
        },
      ]);
    } else {
      Alert.alert('Open shift', 'Start a new POS shift?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open',
          onPress: async () => {
            await pos.openSession({ branchId, warehouseId, openingFloat: 0 }).catch(() => {});
            void loadSession();
          },
        },
      ]);
    }
  };

  if (!canCheckout) {
    return (
      <Screen title="Sell">
        <EmptyState icon="lock-closed-outline" title="No checkout permission" hint="Your role can't ring up POS sales." />
      </Screen>
    );
  }

  return (
    <Screen
      title="Sell"
      subtitle={session ? `Shift ${session.number ?? ''} · ${money(session.salesTotal ?? 0, CURRENCY)}` : 'No open shift'}
      right={<IconButton icon="time-outline" onPress={onShift} />}
    >
      <View style={{ gap: Spacing.sm }}>
        <Input
          icon="search"
          placeholder="Scan or search product…"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          right={<IconButton icon="scan" tint="primary" size={36} onPress={() => setScanning(true)} />}
        />
        {results.length > 0 ? (
          <Card padded={false} style={{ maxHeight: 240 }}>
            <FlatList
              data={results}
              keyExtractor={(p) => p.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable onPress={() => addProduct(item)} style={[styles.result, { borderBottomColor: palette.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text variant="body" weight="semibold" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {item.barcode || item.sku || '—'}
                    </Text>
                  </View>
                  <Text variant="body" weight="bold">
                    {money(item.unitPrice ?? 0, item.currencyCode ?? CURRENCY)}
                  </Text>
                </Pressable>
              )}
            />
          </Card>
        ) : null}

        <View style={styles.selectors}>
          <View style={{ flex: 1 }}>
            <Select
              icon="business-outline"
              value={warehouseId}
              options={warehouses.map((w) => ({ id: w.id, name: w.name }))}
              onSelect={setWarehouseId}
              placeholder="Warehouse"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Select
              icon="person-outline"
              value={dealerId}
              options={dealers.map((d) => ({ id: d.id, name: d.name }))}
              onSelect={setDealerId}
              placeholder="Walk-in"
              noneLabel="Walk-in customer"
              searchable
            />
          </View>
        </View>
      </View>

      <FlatList
        style={{ flex: 1, marginTop: Spacing.sm }}
        contentContainerStyle={{ paddingBottom: 220 }}
        data={cart.lines}
        keyExtractor={(l) => l.key}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<EmptyState icon="scan-outline" title="Basket is empty" hint="Scan a barcode or search to add items." />}
        renderItem={({ item }) => (
          <LineItemRow
            line={item}
            currency={CURRENCY}
            onQty={(q) => cart.setQty(item.key, q)}
            onRemove={() => cart.remove(item.key)}
            stockWarning={item.productId && stockWarn[item.productId] ? 'Out of stock' : null}
          />
        )}
      />

      <Glass strong radius={Radius.xl} style={styles.checkout}>
        <View style={styles.totalsRow}>
          <View>
            <Text variant="caption" tone="muted">
              {cart.totals.count} item{cart.totals.count === 1 ? '' : 's'} · tax {money(cart.totals.tax, CURRENCY)}
            </Text>
            <Text variant="title" weight="heavy">
              {money(total, CURRENCY)}
            </Text>
          </View>
          {!online ? <Badge tone="warning" label="Offline" /> : null}
        </View>
        <Button title="Charge" icon="card-outline" size="lg" disabled={!cart.lines.length} onPress={() => setPaying(true)} />
      </Glass>

      <ScannerSheet visible={scanning} onClose={() => setScanning(false)} onScan={onScan} title="Scan to sell" />
      <PaymentSheet visible={paying} total={total} currency={CURRENCY} onClose={() => setPaying(false)} onConfirm={completeSale} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  selectors: { flexDirection: 'row', gap: Spacing.sm },
  result: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  checkout: { position: 'absolute', left: Spacing.lg, right: Spacing.lg, bottom: 96, padding: Spacing.lg, gap: Spacing.md },
  totalsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
