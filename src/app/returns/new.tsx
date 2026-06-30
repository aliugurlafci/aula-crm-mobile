import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useSync } from '@/lib/sync/SyncProvider';
import { useReference } from '@/lib/hooks/useReference';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useSaleCart } from '@/lib/hooks/useSaleCart';
import { resolveProduct } from '@/lib/pos/resolve';
import { searchProducts } from '@/lib/db/products';
import { uid, money } from '@/lib/format';
import type { Product } from '@/lib/types';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { Spacing } from '@/lib/theme/tokens';
import { Screen } from '@/components/Screen';
import { ScannerSheet } from '@/components/ScannerSheet';
import { LineItemRow } from '@/components/pos/LineItemRow';
import { Button, Card, Input, IconButton, Select, Text, EmptyState, Banner } from '@/components/ui';

const CURRENCY = 'USD';

export default function NewReturn() {
  const router = useRouter();
  const { palette } = useTheme();
  const { online, submit } = useSync();
  const { warehouses, dealers, branches } = useReference();
  const cart = useSaleCart();

  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [dealerId, setDealerId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 200);
  const [results, setResults] = useState<Product[]>([]);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);

  const branchId = warehouses.find((w) => w.id === warehouseId)?.branchId ?? branches[0]?.id ?? null;

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

  const create = async () => {
    if (!cart.lines.length) return;
    setSaving(true);
    const idem = uid('ret_');
    await submit(
      'return.create',
      {
        accountId: dealerId,
        warehouseId,
        branchId,
        currencyCode: CURRENCY,
        reason: reason.trim() || undefined,
        lines: cart.lines.map((l) => ({ productId: l.productId, description: l.description, qty: l.qty, unitPrice: l.unitPrice, taxRate: l.taxRate })),
      },
      idem,
    );
    setSaving(false);
    Alert.alert('Return created', online ? 'Open it from the list to restock.' : 'Queued — will create when back online.');
    router.back();
  };

  return (
    <Screen title="New return" back>
      {!online ? <Banner tone="warning" message="Offline — the return will be created when you reconnect." /> : null}

      <View style={{ gap: Spacing.sm }}>
        <Input
          icon="search"
          placeholder="Scan or search returned item…"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          right={<IconButton icon="scan" tint="primary" size={36} onPress={() => setScanning(true)} />}
        />
        {results.length > 0 ? (
          <Card padded={false} style={{ maxHeight: 180 }}>
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
            <Select icon="business-outline" value={warehouseId} options={warehouses.map((w) => ({ id: w.id, name: w.name }))} onSelect={setWarehouseId} placeholder="Restock to" />
          </View>
          <View style={{ flex: 1 }}>
            <Select icon="person-outline" value={dealerId} options={dealers.map((d) => ({ id: d.id, name: d.name }))} onSelect={setDealerId} placeholder="Customer" noneLabel="Walk-in customer" searchable />
          </View>
        </View>
        <Input icon="chatbox-ellipses-outline" placeholder="Reason (optional)" value={reason} onChangeText={setReason} />
      </View>

      <FlatList
        style={{ flex: 1, marginTop: Spacing.sm }}
        contentContainerStyle={{ paddingBottom: 120 }}
        data={cart.lines}
        keyExtractor={(l) => l.key}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<EmptyState icon="arrow-undo-outline" title="No items" hint="Scan or search the returned products." />}
        renderItem={({ item }) => (
          <LineItemRow line={item} currency={CURRENCY} onQty={(q) => cart.setQty(item.key, q)} onRemove={() => cart.remove(item.key)} />
        )}
      />

      <View style={styles.footer}>
        <Button
          title={`Create return · ${money(cart.totals.total, CURRENCY)}`}
          icon="checkmark-circle"
          loading={saving}
          disabled={!cart.lines.length}
          onPress={create}
        />
      </View>

      <ScannerSheet visible={scanning} onClose={() => setScanning(false)} onScan={onScan} title="Scan returned item" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  selectors: { flexDirection: 'row', gap: Spacing.sm },
  result: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  footer: { position: 'absolute', left: Spacing.lg, right: Spacing.lg, bottom: Spacing.lg },
});
