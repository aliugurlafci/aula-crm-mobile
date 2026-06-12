/**
 * Cart editor — build or resume a basket. Scan/search to add items, pick the
 * warehouse + customer, Save the draft (server-side, online) and Checkout. An
 * existing cart converts via /carts/:id/checkout; a brand-new basket (or any
 * offline checkout) rings up through the offline-safe POS queue.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useSync } from '@/lib/sync/SyncProvider';
import { useReference } from '@/lib/hooks/useReference';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useSaleCart } from '@/lib/hooks/useSaleCart';
import { resolveProduct } from '@/lib/pos/resolve';
import { searchProducts } from '@/lib/db/products';
import { carts } from '@/lib/api/endpoints';
import { uid, money } from '@/lib/format';
import type { Payment, Product, SaleLine } from '@/lib/types';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { Spacing } from '@/lib/theme/tokens';
import { Screen } from '@/components/Screen';
import { ScannerSheet } from '@/components/ScannerSheet';
import { LineItemRow } from '@/components/pos/LineItemRow';
import { PaymentSheet } from '@/components/pos/PaymentSheet';
import { Button, Card, Input, IconButton, Select, Text, EmptyState, Banner } from '@/components/ui';

const CURRENCY = 'USD';

export default function CartEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const router = useRouter();
  const { palette } = useTheme();
  const { online, submit } = useSync();
  const { warehouses, dealers, branches } = useReference();
  const cart = useSaleCart();

  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [dealerId, setDealerId] = useState<string | null>(null);
  const [number, setNumber] = useState<string>('New cart');
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 200);
  const [results, setResults] = useState<Product[]>([]);
  const [scanning, setScanning] = useState(false);
  const [paying, setPaying] = useState(false);
  const [saving, setSaving] = useState(false);

  const branchId = warehouses.find((w) => w.id === warehouseId)?.branchId ?? branches[0]?.id ?? null;

  // Load an existing cart.
  useEffect(() => {
    if (isNew) return;
    let alive = true;
    carts
      .get(String(id))
      .then(({ doc, lines }) => {
        if (!alive) return;
        setNumber(String(doc.number ?? 'Cart'));
        setWarehouseId((doc.warehouseId as string) ?? null);
        setDealerId((doc.accountId as string) ?? null);
        cart.setLines(
          lines.map<SaleLine>((l) => ({
            key: uid('ln_'),
            productId: (l.productId as string) ?? null,
            description: String(l.description ?? ''),
            qty: Number(l.qty ?? 1),
            unitPrice: Number(l.unitPrice ?? 0),
            taxRate: Number(l.taxRate ?? 0),
          })),
        );
      })
      .catch(() => Alert.alert('Error', 'Could not load this cart.'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  useEffect(() => {
    if (!warehouseId && warehouses.length) setWarehouseId(warehouses[0].id);
  }, [warehouses, warehouseId]);

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

  const onScan = useCallback(
    async (code: string) => {
      const { product, offline } = await resolveProduct(code);
      if (product) cart.addProduct(product);
      else Alert.alert('Not found', offline ? 'No cached product. Connect to look it up.' : 'No matching product.');
    },
    [cart],
  );

  const lineInputs = () =>
    cart.lines.map((l) => ({ productId: l.productId, description: l.description, qty: l.qty, unitPrice: l.unitPrice, taxRate: l.taxRate }));

  const saveDraft = async () => {
    if (!online) {
      Alert.alert('Offline', 'Saving a draft needs a connection. You can still checkout — it will queue.');
      return;
    }
    if (!cart.lines.length) return;
    setSaving(true);
    try {
      if (isNew) {
        await carts.create({ warehouseId, branchId, accountId: dealerId, currencyCode: CURRENCY, lines: lineInputs() });
      } else {
        await carts.update(String(id), {
          header: { warehouseId, accountId: dealerId, branchId, currencyCode: CURRENCY },
          lines: lineInputs(),
        });
      }
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save the cart.');
    } finally {
      setSaving(false);
    }
  };

  const checkout = async (payment: Payment, change: number) => {
    if (!cart.lines.length) return;
    const idem = uid('cart_');
    if (!isNew && online) {
      // Persist edits then convert the server cart to an invoice.
      try {
        await carts.update(String(id), {
          header: { warehouseId, accountId: dealerId, branchId, currencyCode: CURRENCY },
          lines: lineInputs(),
        });
        await carts.checkout(String(id), [payment], idem);
        finishCheckout(payment, change);
        return;
      } catch {
        // fall through to the offline-safe path
      }
    }
    // New cart or offline: ring up through the POS queue (same invoice→send pipeline).
    await submit(
      'pos.checkout',
      {
        branchId,
        warehouseId,
        dealerId,
        currencyCode: CURRENCY,
        lines: lineInputs(),
        payments: [payment],
        idempotencyKey: idem,
      },
      idem,
    );
    finishCheckout(payment, change);
  };

  const finishCheckout = (payment: Payment, change: number) => {
    setPaying(false);
    cart.clear();
    Alert.alert(
      'Sale recorded',
      `${money(cart.totals.total, CURRENCY)} · ${payment.method}${change > 0 ? ` · change ${money(change, CURRENCY)}` : ''}`,
    );
    router.back();
  };

  return (
    <Screen title={isNew ? 'New cart' : number} back>
      {!online ? <Banner tone="warning" message="Offline — checkout will queue; saving a draft needs a connection." /> : null}

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
          <Card padded={false} style={{ maxHeight: 200 }}>
            <FlatList
              data={results}
              keyExtractor={(p) => p.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    cart.addProduct(item);
                    setSearch('');
                    setResults([]);
                  }}
                  style={[styles.result, { borderBottomColor: palette.border }]}
                >
                  <Text variant="body" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
                    {item.name}
                  </Text>
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
            <Select icon="business-outline" value={warehouseId} options={warehouses.map((w) => ({ id: w.id, name: w.name }))} onSelect={setWarehouseId} placeholder="Warehouse" />
          </View>
          <View style={{ flex: 1 }}>
            <Select icon="person-outline" value={dealerId} options={dealers.map((d) => ({ id: d.id, name: d.name }))} onSelect={setDealerId} placeholder="Customer" noneLabel="Walk-in customer" searchable />
          </View>
        </View>
      </View>

      <FlatList
        style={{ flex: 1, marginTop: Spacing.sm }}
        contentContainerStyle={{ paddingBottom: 160 }}
        data={cart.lines}
        keyExtractor={(l) => l.key}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<EmptyState icon="bag-handle-outline" title="Empty basket" hint="Scan or search to add items." />}
        renderItem={({ item }) => (
          <LineItemRow line={item} currency={CURRENCY} onQty={(q) => cart.setQty(item.key, q)} onRemove={() => cart.remove(item.key)} />
        )}
      />

      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Button title="Save draft" variant="outline" icon="bookmark-outline" loading={saving} disabled={!cart.lines.length} onPress={saveDraft} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={`Charge ${money(cart.totals.total, CURRENCY)}`} icon="card-outline" disabled={!cart.lines.length} onPress={() => setPaying(true)} />
        </View>
      </View>

      <ScannerSheet visible={scanning} onClose={() => setScanning(false)} onScan={onScan} title="Scan to add" />
      <PaymentSheet visible={paying} total={cart.totals.total} currency={CURRENCY} onClose={() => setPaying(false)} onConfirm={checkout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  selectors: { flexDirection: 'row', gap: Spacing.sm },
  result: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  footer: { position: 'absolute', left: Spacing.lg, right: Spacing.lg, bottom: Spacing.lg, flexDirection: 'row', gap: Spacing.sm },
});
