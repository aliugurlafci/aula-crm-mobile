/**
 * Sales returns (İadeler). Lists recent returns and lets a draft be posted
 * (restocks the goods server-side). "New return" opens the composer. Posting is
 * queued through the outbox so it's offline-safe too.
 */
import { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { useAuth } from '@/lib/auth/AuthProvider';
import { useSync } from '@/lib/sync/SyncProvider';
import { returns } from '@/lib/api/endpoints';
import { ApiRequestError } from '@/lib/api/client';
import { money, relativeTime, uid } from '@/lib/format';
import type { EntityRecord } from '@/lib/types';
import { Spacing } from '@/lib/theme/tokens';
import { Screen } from '@/components/Screen';
import { Card, Text, Badge, EmptyState, Button, Banner, IconButton } from '@/components/ui';

export default function ReturnsScreen() {
  const router = useRouter();
  const { can } = useAuth();
  const { online, submit } = useSync();
  const [items, setItems] = useState<EntityRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await returns.list();
      setItems(page.items ?? []);
    } catch (err) {
      setError(err instanceof ApiRequestError && err.isNetwork ? 'Offline — connect to load returns.' : 'Could not load returns.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const canCreate = can('salesReturn:create');
  const canPost = can('salesReturn:post');

  const post = (id: string) => {
    Alert.alert('Restock & post', 'Post this return and restock the goods?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Post',
        onPress: async () => {
          await submit('return.post', { id }, uid('rpost_'));
          setTimeout(load, 600);
        },
      },
    ]);
  };

  return (
    <Screen
      title="Returns"
      subtitle="Restock returned goods"
      right={canCreate ? <IconButton icon="add" tint="primary" onPress={() => router.push('/returns/new')} /> : undefined}
    >
      {!online ? <Banner tone="warning" message="Listing returns needs a connection. New returns queue offline." /> : null}
      {error && online ? <Banner tone="danger" message={error} /> : null}

      <FlatList
        style={{ flex: 1, marginTop: Spacing.sm }}
        contentContainerStyle={{ paddingBottom: 120, gap: Spacing.sm }}
        data={items}
        keyExtractor={(r) => String(r.id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          <EmptyState
            icon="arrow-undo-outline"
            title="No returns"
            hint={canCreate ? 'Tap + to record a customer return.' : 'No returns recorded.'}
          />
        }
        renderItem={({ item }) => {
          const status = String(item.status ?? 'draft');
          return (
            <Card padded={false}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight="bold">
                    {String(item.number ?? 'Return')}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {item.createdAt ? relativeTime(String(item.createdAt)) : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text variant="subtitle" weight="bold">
                    {money(Number(item.total ?? 0), String(item.currencyCode ?? 'USD'))}
                  </Text>
                  <Badge tone={status === 'posted' ? 'success' : status === 'void' ? 'danger' : 'warning'} label={status} />
                </View>
                {status === 'draft' && canPost ? (
                  <Button title="Restock" variant="outline" size="sm" icon="cube" onPress={() => post(String(item.id))} />
                ) : null}
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
});
