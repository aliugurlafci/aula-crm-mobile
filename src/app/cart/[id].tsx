/**
 * Cart editor — build or resume a basket, then work it one of two ways:
 *
 *  · **Send to register** — the basket gets a short pickup code and waits at the
 *    cash desk, where the cashier takes payment, closes it on account, suspends
 *    it or rejects it. Needs a connection (the code comes from the server) and
 *    the `cart:send` grant.
 *  · **Charge here** — the original flow: tender on the spot. An existing cart
 *    converts via /carts/:id/checkout; a brand-new basket (or any offline sale)
 *    rings up through the offline-safe POS queue. Needs `cart:checkout`.
 *
 * Which buttons appear comes from the server (`actions` on the loaded cart), so
 * the UI can never offer something the permission matrix withholds.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/lib/auth/AuthProvider';
import { useSync } from '@/lib/sync/SyncProvider';
import { useReference } from '@/lib/hooks/useReference';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useSaleCart } from '@/lib/hooks/useSaleCart';
import { resolveProduct } from '@/lib/pos/resolve';
import { searchProducts } from '@/lib/db/products';
import { carts, type CartAction } from '@/lib/api/endpoints';
import { uid, money } from '@/lib/format';
import type { Payment, Product, SaleLine } from '@/lib/types';
import { useI18n } from '@/lib/i18n/LanguageProvider';
import { statusKey } from '@/lib/i18n/translations';
import { cartStatusTone } from '@/lib/pos/cart-status';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { Radius, Spacing } from '@/lib/theme/tokens';
import { Screen } from '@/components/Screen';
import { ScannerSheet } from '@/components/ScannerSheet';
import { LineItemRow } from '@/components/pos/LineItemRow';
import { PaymentSheet } from '@/components/pos/PaymentSheet';
import { Button, Card, Glass, Input, IconButton, Select, Text, EmptyState, Banner, Badge } from '@/components/ui';

const CURRENCY = 'USD';
/** States whose basket contents are settled — nothing left to edit or charge. */
const FINAL_STATES = ['converted', 'cancelled'];

export default function CartEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const router = useRouter();
  const { palette } = useTheme();
  const { t } = useI18n();
  const { can } = useAuth();
  const { online, submit } = useSync();
  const { warehouses, dealers, branches } = useReference();
  const cart = useSaleCart();

  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [dealerId, setDealerId] = useState<string | null>(null);
  const [number, setNumber] = useState<string>('');
  const [status, setStatus] = useState<string>('open');
  const [code, setCode] = useState<number>(0);
  const [createdByName, setCreatedByName] = useState<string>('');
  // For a fresh basket the server has no record to reason about yet, so fall back
  // to the session's own grants; a loaded cart reports exactly what it allows.
  const [actions, setActions] = useState<CartAction[]>([]);
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 200);
  const [results, setResults] = useState<Product[]>([]);
  const [scanning, setScanning] = useState(false);
  const [paying, setPaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const branchId = warehouses.find((w) => w.id === warehouseId)?.branchId ?? branches[0]?.id ?? null;
  const isFinal = FINAL_STATES.includes(status);
  const queued = status === 'sent' || status === 'suspended';
  // A draft belongs to whoever is holding the phone; a queued basket belongs to
  // the register, so touching it needs the same grant the cashier uses.
  const editable = !isFinal && (isNew || status === 'open' || (queued && can('cart:update')));
  /**
   * May this action run right now? A saved cart reports exactly what the server
   * will honour; an unsaved basket has no record yet, so fall back to the
   * session's grants — and only for the two actions that can create one.
   */
  const allows = (action: CartAction) =>
    isNew ? (action === 'send' || action === 'checkout') && can(`cart:${action}`) : actions.includes(action);

  // Load an existing cart.
  useEffect(() => {
    if (isNew) return;
    let alive = true;
    carts
      .get(String(id))
      .then(({ doc, lines, actions: allowed }) => {
        if (!alive) return;
        setNumber(String(doc.number ?? ''));
        setStatus(String(doc.status ?? 'open'));
        setCode(Number(doc.code ?? 0));
        setCreatedByName(String(doc.createdByName ?? ''));
        setActions(allowed ?? []);
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
      .catch(() => Alert.alert(t('common.error'), t('cartEdit.loadFailed')));
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
    async (rawCode: string) => {
      const { product, offline } = await resolveProduct(rawCode);
      if (product) cart.addProduct(product);
      else Alert.alert(t('pos.notFoundTitle'), offline ? t('pos.notFoundOffline', { code: rawCode }) : t('pos.notFoundOnline', { code: rawCode }));
    },
    [cart, t],
  );

  const lineInputs = () =>
    cart.lines.map((l) => ({ productId: l.productId, description: l.description, qty: l.qty, unitPrice: l.unitPrice, taxRate: l.taxRate }));

  const header = () => ({ warehouseId, accountId: dealerId, branchId, currencyCode: CURRENCY });

  /** Create or update the server-side cart and return its id. */
  const persist = async (): Promise<string> => {
    if (isNew) {
      const created = await carts.create({ warehouseId, branchId, accountId: dealerId, currencyCode: CURRENCY, lines: lineInputs() });
      return String(created.doc.id);
    }
    await carts.update(String(id), { header: header(), lines: lineInputs() });
    return String(id);
  };

  const saveDraft = async () => {
    if (!online) {
      Alert.alert(t('cartEdit.offlineTitle'), t('cartEdit.offlineSave'));
      return;
    }
    if (!cart.lines.length) return;
    setSaving(true);
    try {
      await persist();
      router.back();
    } catch {
      Alert.alert(t('common.error'), t('cartEdit.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Hand the basket to the cash desk and show the pickup code the customer
   * quotes at the till. Server-assigned, so this needs a connection.
   */
  const sendToRegister = async () => {
    if (!cart.lines.length) return;
    if (!online) {
      Alert.alert(t('cartEdit.offlineTitle'), t('cartEdit.offlineSend'));
      return;
    }
    setSending(true);
    try {
      const cartId = await persist();
      const { code: assigned } = await carts.send(cartId);
      Alert.alert(t('cartEdit.sentTitle'), t('cartEdit.sentBody', { code: String(assigned) }), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert(t('common.error'), t('cartEdit.sendFailed'));
    } finally {
      setSending(false);
    }
  };

  const runAction = async (action: 'suspend' | 'resume' | 'cancel') => {
    if (isNew) return;
    setSending(true);
    try {
      await carts[action](String(id));
      router.back();
    } catch {
      Alert.alert(t('common.error'), t('cartEdit.actionFailed'));
    } finally {
      setSending(false);
    }
  };

  const checkout = async (payment: Payment, change: number) => {
    if (!cart.lines.length) return;
    const idem = uid('cart_');
    if (!isNew && online) {
      // Persist edits then convert the server cart to an invoice.
      try {
        await carts.update(String(id), { header: header(), lines: lineInputs() });
        await carts.checkout(String(id), [payment], idem);
        finishCheckout(payment, change);
        return;
      } catch {
        // A basket that lives in the register queue must not be re-rung through
        // the POS path: that would invoice it twice and leave it queued. Only a
        // plain draft may fall back to the offline-safe queue.
        if (queued) {
          Alert.alert(t('common.error'), t('cartEdit.chargeFailed'));
          setPaying(false);
          return;
        }
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
    const total = cart.totals.total;
    cart.clear();
    Alert.alert(
      t('pos.saleRecordedTitle'),
      `${money(total, CURRENCY)} · ${payment.method}${change > 0 ? t('pos.saleChange', { amount: money(change, CURRENCY) }) : ''}`,
    );
    router.back();
  };

  // The pickup code is the cart's identity once it is at the register, so it
  // leads the header; the status rides in the header's badge slot.
  const title = isNew ? t('cartEdit.newTitle') : code > 0 ? `${t('cartEdit.cartNo')} ${code}` : number || t('cart.cart');
  const sKey = statusKey(status);
  const statusBadge = isNew ? undefined : <Badge tone={cartStatusTone(status)} label={sKey ? t(sKey) : status} />;

  /**
   * The keep/park/drop actions, collected so the bar renders one wrapping row
   * instead of a different button arrangement per state.
   */
  const secondaryActions: {
    key: string;
    title: string;
    icon: 'bookmark-outline' | 'pause-outline' | 'play-outline' | 'close-outline';
    variant: 'outline' | 'ghost';
    disabled: boolean;
    onPress: () => void;
  }[] = [];
  if (editable) {
    secondaryActions.push({
      key: 'save',
      title: queued ? t('cartEdit.saveChanges') : t('cartEdit.saveDraft'),
      icon: 'bookmark-outline',
      variant: 'outline',
      disabled: !cart.lines.length || sending,
      onPress: saveDraft,
    });
  }
  if (allows('suspend')) {
    secondaryActions.push({ key: 'suspend', title: t('cartEdit.suspend'), icon: 'pause-outline', variant: 'outline', disabled: sending, onPress: () => runAction('suspend') });
  }
  if (allows('resume')) {
    secondaryActions.push({ key: 'resume', title: t('cartEdit.resume'), icon: 'play-outline', variant: 'outline', disabled: sending, onPress: () => runAction('resume') });
  }
  if (allows('cancel')) {
    secondaryActions.push({ key: 'cancel', title: t('cartEdit.cancelCart'), icon: 'close-outline', variant: 'ghost', disabled: sending, onPress: () => runAction('cancel') });
  }

  // Keep the last line clear of the floating bar, whose height depends on how
  // many actions this session actually gets (totals row + up to three rows).
  const barHeight =
    Spacing.lg * 2 +
    56 +
    (allows('send') && !queued ? 60 : 0) +
    (allows('checkout') ? 60 : 0) +
    (secondaryActions.length ? 44 : 0);

  return (
    <Screen
      title={title}
      subtitle={!isNew && createdByName ? t('cartEdit.by', { name: createdByName }) : undefined}
      back
      right={statusBadge}
    >
      {!online && !isFinal ? <Banner tone="warning" message={t('cartEdit.offlineBanner')} /> : null}
      {isFinal ? (
        <Banner
          tone={status === 'converted' ? 'success' : 'danger'}
          message={status === 'converted' ? t('cartEdit.final.converted') : t('cartEdit.final.cancelled')}
        />
      ) : null}

      {editable ? (
        <View style={{ gap: Spacing.sm }}>
          <Input
            icon="search"
            placeholder={t('cartEdit.searchPlaceholder')}
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
      ) : null}

      <FlatList
        style={{ flex: 1, marginTop: Spacing.sm }}
        contentContainerStyle={{ paddingBottom: barHeight + Spacing.lg }}
        data={cart.lines}
        keyExtractor={(l) => l.key}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<EmptyState icon="bag-handle-outline" title={t('cartEdit.emptyTitle')} hint={t('cartEdit.emptyHint')} />}
        renderItem={({ item }) => (
          <LineItemRow
            line={item}
            currency={CURRENCY}
            readOnly={!editable}
            onQty={(q) => cart.setQty(item.key, q)}
            onRemove={() => cart.remove(item.key)}
          />
        )}
      />

      {/* Totals + actions — the frosted panel the POS terminal closes a sale in.
          A settled cart keeps the totals and simply has nothing left to press. */}
      <Glass strong radius={Radius.xl} style={styles.footer}>
        <View style={styles.totalRow}>
          <View>
            <Text variant="caption" tone="muted">
              {t('pos.itemsTax', { count: cart.totals.count, tax: money(cart.totals.tax, CURRENCY) })}
            </Text>
            <Text variant="title" weight="heavy">
              {money(cart.totals.total, CURRENCY)}
            </Text>
          </View>
          {!online && !isFinal ? <Badge tone="warning" label={t('common.offline')} /> : null}
        </View>

        {/* Primary: the two ways to finish the basket. */}
        {allows('send') && !queued ? (
          <Button
            title={t('cartEdit.sendToRegister')}
            icon="paper-plane-outline"
            size="lg"
            variant={allows('checkout') ? 'outline' : 'primary'}
            loading={sending}
            disabled={!cart.lines.length || saving}
            onPress={sendToRegister}
          />
        ) : null}
        {allows('checkout') ? (
          <Button
            title={t('cartEdit.charge', { amount: money(cart.totals.total, CURRENCY) })}
            icon="card-outline"
            size="lg"
            disabled={!cart.lines.length || saving || sending}
            onPress={() => setPaying(true)}
          />
        ) : null}

        {/* Secondary: keep the basket, park it, or drop it. */}
        {secondaryActions.length > 0 ? (
          <View style={styles.secondary}>
            {secondaryActions.map((a) => (
              <View key={a.key} style={{ flex: 1, minWidth: 108 }}>
                <Button
                  title={a.title}
                  icon={a.icon}
                  size="sm"
                  variant={a.variant}
                  loading={a.key === 'save' ? saving : false}
                  disabled={a.disabled}
                  onPress={a.onPress}
                />
              </View>
            ))}
          </View>
        ) : null}
      </Glass>

      <ScannerSheet visible={scanning} onClose={() => setScanning(false)} onScan={onScan} title={t('cartEdit.scanToAdd')} />
      <PaymentSheet visible={paying} total={cart.totals.total} currency={CURRENCY} onClose={() => setPaying(false)} onConfirm={checkout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  selectors: { flexDirection: 'row', gap: Spacing.sm },
  result: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  footer: { position: 'absolute', left: Spacing.lg, right: Spacing.lg, bottom: Spacing.lg, padding: Spacing.lg, gap: Spacing.md },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  secondary: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
