/**
 * Home dashboard — greeting, live sync/offline status, offline-friendly KPIs
 * (cached catalogue + stock + queued sales) and quick actions. A quick-scan
 * jumps straight to a product's detail.
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/lib/auth/AuthProvider';
import { useSync } from '@/lib/sync/SyncProvider';
import { allStock, productCount } from '@/lib/db/products';
import { kvGet } from '@/lib/db/database';
import { resolveProduct } from '@/lib/pos/resolve';
import { initials, money, relativeTime } from '@/lib/format';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { Spacing } from '@/lib/theme/tokens';
import { Screen } from '@/components/Screen';
import { ScannerSheet } from '@/components/ScannerSheet';
import { Card, KpiTile, Text, Badge, Banner, Button, Glass } from '@/components/ui';

export default function HomeScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const { me, can } = useAuth();
  const { online, syncing, counts, lastSyncAt, sync } = useSync();

  const [products, setProducts] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const refresh = useCallback(async () => {
    const [pc, stock, ts] = await Promise.all([productCount(), allStock(), kvGet<string>('catalog.syncedAt')]);
    setProducts(pc);
    setLowStock(stock.filter((s) => s.low).length);
    setSyncedAt(ts);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, lastSyncAt]);

  const onScan = useCallback(
    async (code: string) => {
      const { product } = await resolveProduct(code);
      setScanning(false);
      if (product) router.push(`/product/${product.id}`);
    },
    [router],
  );

  const role = me?.position?.role ?? me?.roles?.[0] ?? 'user';

  return (
    <Screen showSync={false} padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={() => sync('pull-to-refresh')} tintColor={palette.primary} />}
      >
        {/* greeting */}
        <View style={styles.greeting}>
          <View style={{ flex: 1 }}>
            <Text variant="body" tone="muted">
              Welcome back
            </Text>
            <Text variant="title" weight="heavy" numberOfLines={1}>
              {me?.displayName ?? 'Cashier'}
            </Text>
            <Badge tone="primary" label={role.replace(/_/g, ' ')} style={{ marginTop: 4 }} />
          </View>
          <Pressable onPress={() => router.push('/settings')} style={[styles.avatar, { backgroundColor: palette.primary }]}>
            <Text variant="subtitle" weight="heavy" style={{ color: '#fff' }}>
              {initials(me?.displayName ?? '?')}
            </Text>
          </Pressable>
        </View>

        {/* sync status */}
        <Banner
          tone={!online ? 'warning' : counts.failed > 0 ? 'danger' : 'success'}
          title={!online ? 'Offline mode' : counts.failed > 0 ? `${counts.failed} sale(s) need attention` : 'All synced'}
          message={
            !online
              ? `Working from local data. ${counts.pending} queued sale(s) will post when back online.`
              : counts.failed > 0
                ? 'Open Settings → Sync to review failed sales.'
                : `Last sync ${relativeTime(lastSyncAt ? new Date(lastSyncAt).toISOString() : null) || 'just now'}.`
          }
        />

        {/* KPIs */}
        <View style={styles.kpis}>
          <KpiTile icon="cube" label="Products" value={String(products)} tone="primary" />
          <KpiTile icon="warning" label="Low stock" value={String(lowStock)} tone={lowStock > 0 ? 'warning' : 'success'} />
        </View>
        <View style={styles.kpis}>
          <KpiTile icon="cloud-upload" label="Queued sales" value={String(counts.pending)} tone="info" />
          <KpiTile icon="checkmark-done" label="Synced" value={String(counts.done)} tone="success" />
        </View>

        {/* quick actions */}
        <Card style={{ gap: Spacing.md }}>
          <Text variant="subtitle" weight="bold">
            Quick actions
          </Text>
          <View style={styles.actions}>
            <QuickAction icon="scan" label="Scan" onPress={() => setScanning(true)} />
            {can('pos:checkout') ? <QuickAction icon="cart" label="Sell" onPress={() => router.push('/(tabs)/pos')} /> : null}
            {can('labelTemplate:read') || can('product:read') ? (
              <QuickAction icon="pricetags" label="Labels" onPress={() => router.push('/labels')} />
            ) : null}
            {can('salesReturn:read') ? <QuickAction icon="arrow-undo" label="Returns" onPress={() => router.push('/(tabs)/returns')} /> : null}
          </View>
        </Card>

        {syncedAt ? (
          <Text variant="caption" tone="muted2" center>
            Catalogue cached {relativeTime(syncedAt)}
          </Text>
        ) : (
          <Button title="Sync catalogue now" variant="ghost" icon="cloud-download-outline" onPress={() => sync('manual')} />
        )}
      </ScrollView>

      <ScannerSheet visible={scanning} onClose={() => setScanning(false)} onScan={onScan} title="Scan product" />
    </Screen>
  );
}

function QuickAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const { palette } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.actionCell}>
      <Glass radius={16} style={styles.actionGlass}>
        <View style={[styles.actionIcon, { backgroundColor: palette.primary + '1A' }]}>
          <Ionicons name={icon} size={24} color={palette.primary} />
        </View>
      </Glass>
      <Text variant="caption" weight="semibold">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },
  greeting: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  kpis: { flexDirection: 'row', gap: Spacing.md },
  actions: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  actionCell: { alignItems: 'center', gap: 6, width: 64 },
  actionGlass: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  actionIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
