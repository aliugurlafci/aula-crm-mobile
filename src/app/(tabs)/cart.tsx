/**
 * Carts (Sepetler) — server-persisted baskets, segmented by where they are: own
 * drafts to resume, and the ones already handed to the cash desk (waiting or
 * suspended) with the pickup code the cashier searches by. Carts are a server
 * resource, so this list needs connectivity; the editor itself can still queue an
 * offline checkout.
 */
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { useAuth } from '@/lib/auth/AuthProvider';
import { useSync } from '@/lib/sync/SyncProvider';
import { carts } from '@/lib/api/endpoints';
import { ApiRequestError } from '@/lib/api/client';
import { money, relativeTime } from '@/lib/format';
import type { EntityRecord } from '@/lib/types';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n/LanguageProvider';
import { statusKey, type TKey } from '@/lib/i18n/translations';
import { Radius, Spacing } from '@/lib/theme/tokens';
import { Screen } from '@/components/Screen';
import { useTabBarHeight } from '@/components/GlassTabBar';
import { cartStatusTone } from '@/lib/pos/cart-status';
import { Card, Text, Badge, EmptyState, Button, Banner, IconButton } from '@/components/ui';

/** The two views of the list: my drafts, and everything at the cash desk. */
type Filter = 'drafts' | 'register';

const FILTERS: { key: Filter; labelKey: TKey }[] = [
  { key: 'drafts', labelKey: 'cart.filter.drafts' },
  { key: 'register', labelKey: 'cart.filter.register' },
];

export default function CartListScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const { can } = useAuth();
  const { online } = useSync();
  const { t, lang } = useI18n();
  const tabBarSpace = useTabBarHeight();
  const [filter, setFilter] = useState<Filter>('drafts');
  const [items, setItems] = useState<EntityRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (which: Filter) => {
      setLoading(true);
      setError(null);
      try {
        const page = await carts.list(
          // Drafts are personal (resume your own basket); the register queue is
          // shared — everything waiting at the cash desk, whoever built it.
          which === 'drafts' ? { statuses: ['open'], mine: true } : { statuses: ['sent', 'suspended'] },
        );
        setItems(page.items ?? []);
      } catch (err) {
        setError(err instanceof ApiRequestError && err.isNetwork ? t('cart.errorOffline') : t('cart.errorGeneric'));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useFocusEffect(
    useCallback(() => {
      void load(filter);
    }, [load, filter]),
  );

  const canCreate = can('cart:create');
  const drafts = filter === 'drafts';

  return (
    <Screen
      title={t('cart.title')}
      subtitle={t('cart.subtitle')}
      right={canCreate ? <IconButton icon="add" tint="primary" onPress={() => router.push('/cart/new')} /> : undefined}
    >
      {!online ? <Banner tone="warning" message={t('cart.offlineBanner')} /> : null}
      {error && online ? <Banner tone="danger" message={error} /> : null}

      <View style={styles.segment}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => {
                setFilter(f.key);
                void load(f.key);
              }}
              style={[
                styles.segItem,
                {
                  borderColor: active ? palette.primary : palette.border,
                  backgroundColor: active ? palette.primary + '18' : 'transparent',
                },
              ]}
            >
              <Text variant="caption" tone={active ? 'primary' : 'muted'} weight="semibold">
                {t(f.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        style={{ flex: 1, marginTop: Spacing.sm }}
        contentContainerStyle={{ paddingBottom: tabBarSpace + (canCreate ? 72 : Spacing.md), gap: Spacing.sm }}
        data={items}
        keyExtractor={(c) => String(c.id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(filter)} tintColor={palette.primary} />}
        ListEmptyComponent={
          <EmptyState
            icon={drafts ? 'bookmarks-outline' : 'storefront-outline'}
            title={drafts ? t('cart.empty') : t('cart.emptyRegister')}
            hint={drafts ? (canCreate ? t('cart.emptyHintCreate') : t('cart.emptyHint')) : t('cart.emptyRegisterHint')}
          />
        }
        renderItem={({ item }) => {
          const status = String(item.status ?? 'open');
          const sKey = statusKey(status);
          const code = Number(item.code ?? 0);
          return (
            <Pressable onPress={() => router.push(`/cart/${item.id}`)}>
              <Card padded={false}>
                <View style={styles.row}>
                  {code > 0 ? (
                    // The number the customer quotes at the till — the row's anchor.
                    <View style={[styles.codeChip, { backgroundColor: palette.primary + '1A' }]}>
                      <Text variant="subtitle" weight="heavy" tone="primary">
                        {code}
                      </Text>
                    </View>
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Text variant="body" weight="semibold" numberOfLines={1}>
                      {String(item.createdByName ?? item.number ?? t('cart.cart'))}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {item.sentAt
                        ? t('cart.sentAt', { time: relativeTime(String(item.sentAt), lang) })
                        : item.createdAt
                          ? t('cart.created', { time: relativeTime(String(item.createdAt), lang) })
                          : t('cart.draft')}
                    </Text>
                  </View>
                  <View style={styles.amountCol}>
                    <Text variant="subtitle" weight="bold">
                      {money(Number(item.total ?? 0), String(item.currencyCode ?? 'USD'))}
                    </Text>
                    <Badge tone={cartStatusTone(status)} label={sKey ? t(sKey) : status} />
                  </View>
                </View>
              </Card>
            </Pressable>
          );
        }}
      />

      {canCreate ? (
        <View style={[styles.fabWrap, { bottom: tabBarSpace + Spacing.sm }]}>
          <Button title={t('cart.new')} icon="add" onPress={() => router.push('/cart/new')} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  codeChip: { minWidth: 44, height: 40, paddingHorizontal: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  amountCol: { alignItems: 'flex-end', gap: 4 },
  fabWrap: { position: 'absolute', left: Spacing.lg, right: Spacing.lg },
});
