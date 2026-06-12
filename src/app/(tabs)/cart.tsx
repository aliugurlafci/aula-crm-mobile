/**
 * Saved carts (Sepetler) — server-persisted draft baskets. List open drafts,
 * open one to resume/checkout, or start a new cart. Carts are a server resource,
 * so this list needs connectivity; the editor itself can queue its checkout.
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
import { Spacing } from '@/lib/theme/tokens';
import { Screen } from '@/components/Screen';
import { Card, Text, Badge, EmptyState, Button, Banner, IconButton } from '@/components/ui';

export default function CartListScreen() {
  const router = useRouter();
  const { can } = useAuth();
  const { online } = useSync();
  const [items, setItems] = useState<EntityRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await carts.list();
      setItems(page.items ?? []);
    } catch (err) {
      setError(err instanceof ApiRequestError && err.isNetwork ? 'Offline — connect to load saved carts.' : 'Could not load carts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const canCreate = can('cart:create');

  return (
    <Screen
      title="Carts"
      subtitle="Saved baskets"
      right={canCreate ? <IconButton icon="add" tint="primary" onPress={() => router.push('/cart/new')} /> : undefined}
    >
      {!online ? <Banner tone="warning" message="Saved carts require a connection. New carts ring up through the offline queue." /> : null}
      {error && online ? <Banner tone="danger" message={error} /> : null}

      <FlatList
        style={{ flex: 1, marginTop: Spacing.sm }}
        contentContainerStyle={{ paddingBottom: 120, gap: Spacing.sm }}
        data={items}
        keyExtractor={(c) => String(c.id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          <EmptyState
            icon="bookmarks-outline"
            title="No saved carts"
            hint={canCreate ? 'Tap + to start a new basket you can save and resume.' : 'No open baskets.'}
          />
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/cart/${item.id}`)}>
            <Card padded={false}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight="bold">
                    {String(item.number ?? 'Cart')}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {item.createdAt ? `Created ${relativeTime(String(item.createdAt))}` : 'Draft'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text variant="subtitle" weight="bold">
                    {money(Number(item.total ?? 0), String(item.currencyCode ?? 'USD'))}
                  </Text>
                  <Badge tone="info" label={String(item.status ?? 'open')} />
                </View>
              </View>
            </Card>
          </Pressable>
        )}
      />

      {canCreate ? (
        <View style={styles.fabWrap}>
          <Button title="New cart" icon="add" onPress={() => router.push('/cart/new')} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  fabWrap: { position: 'absolute', left: Spacing.lg, right: Spacing.lg, bottom: 96 },
});
