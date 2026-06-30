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
import { useI18n } from '@/lib/i18n/LanguageProvider';
import type { TKey } from '@/lib/i18n/translations';
import { Radius, Spacing } from '@/lib/theme/tokens';
import { Screen } from '@/components/Screen';
import { ScannerSheet } from '@/components/ScannerSheet';
import { useTabBarHeight } from '@/components/GlassTabBar';
import { LineItemRow } from '@/components/pos/LineItemRow';
import { PaymentSheet } from '@/components/pos/PaymentSheet';
import { Button, Card, Badge, Glass, Input, IconButton, Select, Text, EmptyState } from '@/components/ui';

const CURRENCY = 'USD';

export default function PosScreen() {
  const { palette } = useTheme();
  const { t } = useI18n();
  const tabBarSpace = useTabBarHeight();
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
          t('pos.notFoundTitle'),
          offline ? t('pos.notFoundOffline', { code }) : t('pos.notFoundOnline', { code }),
        );
    },
    [addProduct, t],
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
    const method = t(`payment.${payment.method}` as TKey);
    const changePart = change > 0 ? t('pos.saleChange', { amount: money(change, CURRENCY) }) : '';
    Alert.alert(
      t('pos.saleRecordedTitle'),
      `${money(total, CURRENCY)} · ${method}${changePart}\n${online ? t('pos.posting') : t('pos.queuedPost')}`,
    );
  };

  const onShift = () => {
    if (!online) {
      Alert.alert(t('pos.shiftOfflineTitle'), t('pos.shiftOfflineMsg'));
      return;
    }
    if (session) {
      Alert.alert(t('pos.closeShiftTitle'), t('pos.closeShiftMsg', { number: session.number ?? '' }), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('pos.close'),
          onPress: async () => {
            await pos.closeSession(session.id, session.expectedCash ?? 0).catch(() => {});
            void loadSession();
          },
        },
      ]);
    } else {
      Alert.alert(t('pos.openShiftTitle'), t('pos.openShiftMsg'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('pos.open'),
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
      <Screen title={t('pos.title')}>
        <EmptyState icon="lock-closed-outline" title={t('pos.noPermTitle')} hint={t('pos.noPermHint')} />
      </Screen>
    );
  }

  return (
    <Screen
      title={t('pos.title')}
      subtitle={session ? t('pos.shift', { number: session.number ?? '', total: money(session.salesTotal ?? 0, CURRENCY) }) : t('pos.noShift')}
      right={<IconButton icon="time-outline" onPress={onShift} />}
    >
      <View style={{ gap: Spacing.sm }}>
        <Input
          icon="search"
          placeholder={t('pos.searchPlaceholder')}
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
              placeholder={t('pos.warehouse')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Select
              icon="person-outline"
              value={dealerId}
              options={dealers.map((d) => ({ id: d.id, name: d.name }))}
              onSelect={setDealerId}
              placeholder={t('pos.walkIn')}
              noneLabel={t('pos.walkInCustomer')}
              searchable
            />
          </View>
        </View>
      </View>

      <FlatList
        style={{ flex: 1, marginTop: Spacing.sm }}
        contentContainerStyle={{ paddingBottom: tabBarSpace + 150 }}
        data={cart.lines}
        keyExtractor={(l) => l.key}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<EmptyState icon="scan-outline" title={t('pos.basketEmpty')} hint={t('pos.basketEmptyHint')} />}
        renderItem={({ item }) => (
          <LineItemRow
            line={item}
            currency={CURRENCY}
            onQty={(q) => cart.setQty(item.key, q)}
            onRemove={() => cart.remove(item.key)}
            stockWarning={item.productId && stockWarn[item.productId] ? t('pos.outOfStock') : null}
          />
        )}
      />

      <Glass strong radius={Radius.xl} style={[styles.checkout, { bottom: tabBarSpace + Spacing.sm }]}>
        <View style={styles.totalsRow}>
          <View>
            <Text variant="caption" tone="muted">
              {t('pos.itemsTax', { count: cart.totals.count, tax: money(cart.totals.tax, CURRENCY) })}
            </Text>
            <Text variant="title" weight="heavy">
              {money(total, CURRENCY)}
            </Text>
          </View>
          {!online ? <Badge tone="warning" label={t('common.offline')} /> : null}
        </View>
        <Button title={t('pos.charge')} icon="card-outline" size="lg" disabled={!cart.lines.length} onPress={() => setPaying(true)} />
      </Glass>

      <ScannerSheet visible={scanning} onClose={() => setScanning(false)} onScan={onScan} title={t('pos.scanToSell')} />
      <PaymentSheet visible={paying} total={total} currency={CURRENCY} onClose={() => setPaying(false)} onConfirm={completeSale} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  selectors: { flexDirection: 'row', gap: Spacing.sm },
  result: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  checkout: { position: 'absolute', left: Spacing.lg, right: Spacing.lg, padding: Spacing.lg, gap: Spacing.md },
  totalsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
