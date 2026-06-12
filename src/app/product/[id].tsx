/**
 * Product detail — info, on-hand stock per warehouse (cached), a live barcode/QR
 * preview, and a one-tap label print. Reads the offline cache first, refreshing
 * from the API when online.
 */
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/lib/auth/AuthProvider';
import { getProduct, stockForProduct } from '@/lib/db/products';
import { entities } from '@/lib/api/endpoints';
import { printLabels, productToLabel } from '@/lib/barcode/printLabel';
import { generateInternalBarcode } from '@/lib/barcode/check-digit';
import { money, qty } from '@/lib/format';
import type { Product, StockRow } from '@/lib/types';
import { Spacing } from '@/lib/theme/tokens';
import { Screen } from '@/components/Screen';
import { BarcodeView } from '@/components/BarcodeView';
import { Card, Text, Badge, Button, EmptyState } from '@/components/ui';

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { can } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const local = await getProduct(String(id));
      if (alive && local) setProduct(local);
      const rows = await stockForProduct(String(id));
      if (alive) setStock(rows);
      try {
        const fresh = await entities.get<Product>('product', String(id));
        if (alive && fresh) setProduct(fresh);
      } catch {
        /* offline — keep cache */
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (!product) {
    return (
      <Screen title="Product" back>
        <EmptyState icon={loading ? 'hourglass-outline' : 'cube-outline'} title={loading ? 'Loading…' : 'Product not found'} />
      </Screen>
    );
  }

  const onHand = stock.reduce((s, r) => s + r.onHand, 0);
  const code = product.barcode || product.sku || '';
  const currency = product.currencyCode ?? 'USD';

  const print = async () => {
    setPrinting(true);
    try {
      await printLabels([productToLabel({ ...product, barcode: code || generateInternalBarcode() }, 1)]);
    } catch {
      Alert.alert('Print failed', 'Could not open the printer dialog.');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Screen title="Product" back>
      <ScrollView contentContainerStyle={{ gap: Spacing.md, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Card style={{ gap: Spacing.xs }}>
          <Text variant="title" weight="heavy">
            {product.name}
          </Text>
          <View style={styles.metaRow}>
            {product.sku ? <Badge tone="neutral" label={`SKU ${product.sku}`} /> : null}
            <Badge tone={onHand > 0 ? 'success' : 'danger'} label={`${qty(onHand)} on hand`} />
          </View>
          <Text variant="title" weight="bold" tone="primary">
            {money(product.unitPrice ?? 0, currency)}
          </Text>
          {product.taxRate ? (
            <Text variant="caption" tone="muted">
              +{product.taxRate}% tax
            </Text>
          ) : null}
        </Card>

        {code ? (
          <Card style={{ alignItems: 'center', gap: Spacing.sm }}>
            <Text variant="label" tone="muted">
              Barcode
            </Text>
            <BarcodeView value={code} />
          </Card>
        ) : null}

        <Card style={{ gap: Spacing.sm }}>
          <Text variant="subtitle" weight="bold">
            Stock by warehouse
          </Text>
          {stock.length ? (
            stock.map((r) => (
              <View key={`${r.warehouseId}`} style={styles.stockRow}>
                <Text variant="body">{r.warehouseName}</Text>
                <Text variant="body" weight="bold" tone={r.low ? 'danger' : 'default'}>
                  {qty(r.onHand)}
                  {r.low ? ' ⚠︎' : ''}
                </Text>
              </View>
            ))
          ) : (
            <Text variant="caption" tone="muted">
              No stock records cached. Sync while online to load levels.
            </Text>
          )}
        </Card>

        {can('labelTemplate:read') || can('product:read') ? (
          <Button title="Print barcode label" icon="print-outline" size="lg" loading={printing} onPress={print} />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', alignItems: 'center' },
  stockRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
});
