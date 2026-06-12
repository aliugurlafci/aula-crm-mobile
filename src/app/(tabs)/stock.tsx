/**
 * Stock levels — offline-first view of on-hand inventory (cached from
 * GET /inventory/on-hand). Search by name/SKU/barcode, filter to low stock, tap
 * through to product detail. Pull-to-refresh re-syncs when online.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useSync } from '@/lib/sync/SyncProvider';
import { allStock } from '@/lib/db/products';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { money, qty } from '@/lib/format';
import type { StockRow } from '@/lib/types';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { Spacing } from '@/lib/theme/tokens';
import { Screen } from '@/components/Screen';
import { Card, Input, Badge, Text, EmptyState, IconButton } from '@/components/ui';

export default function StockScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const { syncing, sync, lastSyncAt } = useSync();
  const [rows, setRows] = useState<StockRow[]>([]);
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const debounced = useDebounce(search, 200);

  const load = useCallback(async () => setRows(await allStock()), []);
  useEffect(() => {
    void load();
  }, [load, lastSyncAt]);

  const filtered = useMemo(() => {
    const t = debounced.trim().toLowerCase();
    return rows.filter((r) => {
      if (lowOnly && !r.low) return false;
      if (!t) return true;
      return (
        r.productName.toLowerCase().includes(t) ||
        (r.sku ?? '').toLowerCase().includes(t) ||
        (r.barcode ?? '').includes(t)
      );
    });
  }, [rows, debounced, lowOnly]);

  return (
    <Screen title="Stock" subtitle={`${rows.length} stock records`}>
      <View style={{ gap: Spacing.sm }}>
        <Input
          icon="search"
          placeholder="Search product, SKU or barcode…"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          right={
            <IconButton
              icon={lowOnly ? 'warning' : 'warning-outline'}
              tint={lowOnly ? 'danger' : 'surface'}
              size={36}
              onPress={() => setLowOnly((v) => !v)}
            />
          }
        />
        {lowOnly ? <Badge tone="warning" label="Showing low stock only" /> : null}
      </View>

      <FlatList
        style={{ flex: 1, marginTop: Spacing.sm }}
        contentContainerStyle={{ paddingBottom: 120, gap: Spacing.sm }}
        data={filtered}
        keyExtractor={(r, i) => `${r.productId}:${r.warehouseId}:${i}`}
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={() => sync('stock-refresh')} tintColor={palette.primary} />}
        ListEmptyComponent={
          <EmptyState icon="cube-outline" title="No stock data" hint="Sync while online to load inventory levels." />
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/product/${item.productId}`)}>
            <Card padded={false}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight="semibold" numberOfLines={1}>
                    {item.productName}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {item.warehouseName}
                    {item.branchName ? ` · ${item.branchName}` : ''}
                  </Text>
                </View>
                <View style={styles.qtyCol}>
                  <Text variant="title" weight="heavy" tone={item.low ? 'danger' : 'default'}>
                    {qty(item.onHand)}
                  </Text>
                  {item.low ? (
                    <Badge tone="danger" label={`reorder ≤ ${qty(item.reorderLevel)}`} />
                  ) : (
                    <Text variant="caption" tone="muted2">
                      {money(item.value)}
                    </Text>
                  )}
                </View>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  qtyCol: { alignItems: 'flex-end', gap: 4 },
});
