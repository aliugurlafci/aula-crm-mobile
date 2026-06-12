/**
 * Label designer / printing. Scan or search products into a print list, set how
 * many copies of each, preview the barcode, then print to a connected printer or
 * a PDF. Products without a barcode get a generated internal EAN-13.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { useSync } from '@/lib/sync/SyncProvider';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { searchProducts } from '@/lib/db/products';
import { resolveProduct } from '@/lib/pos/resolve';
import { printLabels, labelsToPdf, type LabelSpec } from '@/lib/barcode/printLabel';
import { generateInternalBarcode } from '@/lib/barcode/check-digit';
import { money, uid } from '@/lib/format';
import type { Product } from '@/lib/types';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { Spacing } from '@/lib/theme/tokens';
import { Screen } from '@/components/Screen';
import { ScannerSheet } from '@/components/ScannerSheet';
import { BarcodeView } from '@/components/BarcodeView';
import { Card, Input, IconButton, QtyStepper, Text, EmptyState, Button } from '@/components/ui';

interface LabelItem {
  key: string;
  product: Product;
  code: string;
  copies: number;
}

export default function LabelsScreen() {
  const { palette } = useTheme();
  const { online } = useSync();
  const [items, setItems] = useState<LabelItem[]>([]);
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 200);
  const [results, setResults] = useState<Product[]>([]);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);

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

  const addProduct = useCallback((p: Product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === p.id);
      if (existing) return prev.map((i) => (i.key === existing.key ? { ...i, copies: i.copies + 1 } : i));
      return [{ key: uid('lb_'), product: p, code: p.barcode || p.sku || generateInternalBarcode(), copies: 1 }, ...prev];
    });
    setSearch('');
    setResults([]);
  }, []);

  const onScan = useCallback(
    async (code: string) => {
      const { product } = await resolveProduct(code);
      if (product) addProduct(product);
      else Alert.alert('Not found', `No product for "${code}".`);
    },
    [addProduct],
  );

  const specs = (): LabelSpec[] =>
    items.map((i) => ({
      title: i.product.name,
      priceLabel: i.product.unitPrice != null ? money(i.product.unitPrice, i.product.currencyCode ?? 'USD') : undefined,
      code: i.code,
      copies: i.copies,
    }));

  const onPrint = async () => {
    if (!items.length) return;
    setBusy(true);
    try {
      await printLabels(specs());
    } catch {
      Alert.alert('Print failed', 'Could not open the printer dialog.');
    } finally {
      setBusy(false);
    }
  };

  const onPdf = async () => {
    if (!items.length) return;
    setBusy(true);
    try {
      const uri = await labelsToPdf(specs());
      Alert.alert('PDF ready', `Saved to:\n${uri}`);
    } catch {
      Alert.alert('Export failed', 'Could not generate the PDF.');
    } finally {
      setBusy(false);
    }
  };

  const totalLabels = items.reduce((s, i) => s + i.copies, 0);

  return (
    <Screen title="Labels" subtitle={`${totalLabels} label${totalLabels === 1 ? '' : 's'}`} back>
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
                <Pressable onPress={() => addProduct(item)} style={[styles.result, { borderBottomColor: palette.border }]}>
                  <Text variant="body" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
                    {item.name}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {item.barcode || item.sku || 'no code'}
                  </Text>
                </Pressable>
              )}
            />
          </Card>
        ) : null}
      </View>

      <FlatList
        style={{ flex: 1, marginTop: Spacing.sm }}
        contentContainerStyle={{ paddingBottom: 160, gap: Spacing.sm }}
        data={items}
        keyExtractor={(i) => i.key}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<EmptyState icon="pricetags-outline" title="No labels yet" hint="Scan or search products to build a print run." />}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.itemRow}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="body" weight="semibold" numberOfLines={1}>
                  {item.product.name}
                </Text>
                <BarcodeView value={item.code} width={170} height={64} />
              </View>
              <View style={{ alignItems: 'flex-end', gap: Spacing.sm }}>
                <IconButton icon="trash-outline" tint="danger" size={32} onPress={() => setItems((p) => p.filter((x) => x.key !== item.key))} />
                <QtyStepper value={item.copies} min={1} onChange={(c) => setItems((p) => p.map((x) => (x.key === item.key ? { ...x, copies: Math.max(1, c) } : x)))} />
              </View>
            </View>
          </Card>
        )}
      />

      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Button title="Save PDF" variant="outline" icon="document-outline" loading={busy} disabled={!items.length} onPress={onPdf} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Print" icon="print-outline" loading={busy} disabled={!items.length} onPress={onPrint} />
        </View>
      </View>

      <ScannerSheet visible={scanning} onClose={() => setScanning(false)} onScan={onScan} title="Scan to label" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  result: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  footer: { position: 'absolute', left: Spacing.lg, right: Spacing.lg, bottom: Spacing.lg, flexDirection: 'row', gap: Spacing.sm },
});
