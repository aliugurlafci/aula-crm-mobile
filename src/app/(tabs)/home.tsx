/**
 * Home dashboard — greeting, live sync/offline status, offline-friendly KPIs
 * (cached catalogue + stock + queued sales) and quick actions. KPI tiles deep
 * link into the relevant screen (stock list, low-stock filter, sync queue). A
 * quick-scan jumps straight to a product's detail.
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
import { initials, relativeTime } from '@/lib/format';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n/LanguageProvider';
import { Radius, Spacing } from '@/lib/theme/tokens';
import { Screen } from '@/components/Screen';
import { ScannerSheet } from '@/components/ScannerSheet';
import { useTabBarHeight } from '@/components/GlassTabBar';
import { Card, KpiTile, Text, Badge, Banner, Button } from '@/components/ui';

export default function HomeScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const { t, lang } = useI18n();
  const tabBarSpace = useTabBarHeight();
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
  const lastSyncIso = lastSyncAt ? new Date(lastSyncAt).toISOString() : new Date().toISOString();

  const actions = [
    { key: 'scan', icon: 'scan' as const, label: t('home.action.scan'), onPress: () => setScanning(true), show: true },
    { key: 'sell', icon: 'cart' as const, label: t('home.action.sell'), onPress: () => router.push('/(tabs)/pos'), show: can('pos:checkout') },
    {
      key: 'labels',
      icon: 'pricetags' as const,
      label: t('home.action.labels'),
      onPress: () => router.push('/labels'),
      show: can('labelTemplate:read') || can('product:read'),
    },
    { key: 'returns', icon: 'arrow-undo' as const, label: t('home.action.returns'), onPress: () => router.push('/(tabs)/returns'), show: can('salesReturn:read') },
  ].filter((a) => a.show);

  return (
    <Screen showSync={false} padded={false}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarSpace + Spacing.md }]}
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={() => sync('pull-to-refresh')} tintColor={palette.primary} />}
      >
        {/* greeting */}
        <View style={styles.greeting}>
          <View style={{ flex: 1 }}>
            <Text variant="body" tone="muted">
              {t('home.welcome')}
            </Text>
            <Text variant="title" weight="heavy" numberOfLines={1}>
              {me?.displayName ?? t('home.cashier')}
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
          title={!online ? t('home.status.offlineTitle') : counts.failed > 0 ? t('home.status.attentionTitle', { count: counts.failed }) : t('home.status.allSynced')}
          message={
            !online
              ? t('home.status.offlineMsg', { count: counts.pending })
              : counts.failed > 0
                ? t('home.status.attentionMsg')
                : t('home.status.lastSync', { time: relativeTime(lastSyncIso, lang) })
          }
        />

        {/* KPIs — each deep links into the relevant screen */}
        <View style={styles.kpis}>
          <KpiTile icon="cube" label={t('home.kpi.products')} value={String(products)} tone="primary" onPress={() => router.push('/(tabs)/stock')} />
          <KpiTile
            icon="warning"
            label={t('home.kpi.lowStock')}
            value={String(lowStock)}
            tone={lowStock > 0 ? 'warning' : 'success'}
            onPress={() => router.push('/(tabs)/stock?low=1')}
          />
        </View>
        <View style={styles.kpis}>
          <KpiTile icon="cloud-upload" label={t('home.kpi.queued')} value={String(counts.pending)} tone="info" onPress={() => router.push('/outbox?status=pending')} />
          <KpiTile icon="checkmark-done" label={t('home.kpi.synced')} value={String(counts.done)} tone="success" onPress={() => router.push('/outbox?status=done')} />
        </View>

        {/* quick actions */}
        <View style={{ gap: Spacing.sm }}>
          <Text variant="subtitle" weight="bold">
            {t('home.quickActions')}
          </Text>
          <View style={styles.actionsGrid}>
            {actions.map((a) => (
              <ActionTile key={a.key} icon={a.icon} label={a.label} onPress={a.onPress} />
            ))}
          </View>
        </View>

        {syncedAt ? (
          <Text variant="caption" tone="muted2" center>
            {t('home.cached', { time: relativeTime(syncedAt, lang) })}
          </Text>
        ) : (
          <Button title={t('home.syncNow')} variant="ghost" icon="cloud-download-outline" onPress={() => sync('manual')} />
        )}
      </ScrollView>

      <ScannerSheet visible={scanning} onClose={() => setScanning(false)} onScan={onScan} title={t('home.scanTitle')} />
    </Screen>
  );
}

function ActionTile({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const { palette } = useTheme();
  return (
    <Pressable style={({ pressed }) => [styles.actionTile, pressed ? styles.pressed : null]} onPress={onPress}>
      <Card padded={false} radius={Radius.lg}>
        <View style={styles.actionInner}>
          <View style={[styles.actionChip, { backgroundColor: palette.primary + '1A' }]}>
            <Ionicons name={icon} size={22} color={palette.primary} />
          </View>
          <Text variant="body" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
            {label}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={palette.muted2} />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.lg, gap: Spacing.md },
  greeting: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  kpis: { flexDirection: 'row', gap: Spacing.md },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actionTile: { width: '48%', flexGrow: 1 },
  pressed: { opacity: 0.6, transform: [{ scale: 0.98 }] },
  actionInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  actionChip: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
