/**
 * "More" hub — the menu of every catalog screen the admin has enabled for this
 * user beyond the five bottom tabs. It reads the full screen catalog from
 * GET /screens for labels, then shows only the keys the mobile screen-config
 * allows (useScreenAccess) and the user's grants permit, grouped by area. Each
 * row routes to its bespoke screen or one of the generic hosts via the registry.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { auth } from '@/lib/api/endpoints';
import { ApiRequestError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useScreenAccess } from '@/lib/access';
import { useI18n } from '@/lib/i18n/LanguageProvider';
import { useTheme } from '@/lib/theme/ThemeProvider';
import type { TKey } from '@/lib/i18n/translations';
import { Radius, Spacing } from '@/lib/theme/tokens';
import {
  HUB_HIDDEN,
  canAccessKey,
  hrefForKey,
  iconForKey,
  prettify,
  titleForKey,
  type CatalogScreen,
} from '@/lib/screens/registry';
import { Screen } from '@/components/Screen';
import { useTabBarHeight } from '@/components/GlassTabBar';
import { Card, Text, EmptyState, Button } from '@/components/ui';

/** Localized group headers (falls back to the prettified group key). */
const GROUP_KEYS: Record<string, TKey> = {
  main: 'group.main',
  dashboards: 'group.dashboards',
  sales: 'group.sales',
  inventory: 'group.inventory',
  purchasing: 'group.purchasing',
  accounting: 'group.accounting',
  finance: 'group.finance',
  crm: 'group.crm',
  comms: 'group.comms',
  people: 'group.people',
  admin: 'group.admin',
};
const GROUP_ORDER = ['main', 'dashboards', 'sales', 'inventory', 'purchasing', 'accounting', 'finance', 'crm', 'comms', 'people', 'admin'];

export default function MoreScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const { t } = useI18n();
  const { can } = useAuth();
  const { isAllowed } = useScreenAccess();
  const tabBarSpace = useTabBarHeight();

  const [catalog, setCatalog] = useState<CatalogScreen[] | null>(null);
  const [error, setError] = useState<'offline' | 'error' | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await auth.screens();
      setCatalog(res.screens);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiRequestError && e.isNetwork ? 'offline' : 'error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const sections = useMemo(() => {
    if (!catalog) return [];
    const visible = catalog.filter((s) => !HUB_HIDDEN.has(s.key) && isAllowed(s.key) && canAccessKey(s.key, can));
    const byGroup = new Map<string, CatalogScreen[]>();
    for (const s of visible) {
      const arr = byGroup.get(s.group) ?? [];
      arr.push(s);
      byGroup.set(s.group, arr);
    }
    return [...byGroup.keys()]
      .sort((a, b) => (GROUP_ORDER.indexOf(a) + 1 || 99) - (GROUP_ORDER.indexOf(b) + 1 || 99))
      .map((group) => ({
        group,
        items: byGroup.get(group)!.slice().sort((a, b) => titleForKey(a.key, a.label, t).localeCompare(titleForKey(b.key, b.label, t))),
      }));
  }, [catalog, isAllowed, can, t]);

  const groupLabel = (g: string) => (GROUP_KEYS[g] ? t(GROUP_KEYS[g]) : prettify(g));

  return (
    <Screen title={t('more.title')} subtitle={t('more.subtitle')}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: tabBarSpace + Spacing.md, gap: Spacing.md, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
      >
        {catalog === null && !error ? (
          <View style={styles.center}>
            <EmptyState icon="hourglass-outline" title={t('common.loading')} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <EmptyState
              icon={error === 'offline' ? 'cloud-offline-outline' : 'alert-circle-outline'}
              title={error === 'offline' ? t('more.offline') : t('more.loadError')}
              hint={error === 'offline' ? t('entity.offlineHint') : undefined}
            />
            <View style={styles.retryBtn}>
              <Button title={t('common.retry')} variant="outline" icon="refresh" onPress={() => void load()} />
            </View>
          </View>
        ) : sections.length === 0 ? (
          <View style={styles.center}>
            <EmptyState icon="apps-outline" title={t('more.empty')} hint={t('more.emptyHint')} />
          </View>
        ) : (
          sections.map(({ group, items }) => (
            <View key={group} style={{ gap: Spacing.sm }}>
              <Text variant="caption" weight="bold" tone="muted2" style={styles.groupHeader}>
                {groupLabel(group).toUpperCase()}
              </Text>
              <Card padded={false}>
                {items.map((s, i) => {
                  const label = titleForKey(s.key, s.label, t);
                  return (
                    <Pressable
                      key={s.key}
                      onPress={() => router.push(hrefForKey(s.key, label))}
                      style={[styles.row, i > 0 && { borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth }]}
                    >
                      <View style={[styles.iconWrap, { backgroundColor: palette.primary + '1A' }]}>
                        <Ionicons name={iconForKey(s.key, s.group)} size={20} color={palette.primary} />
                      </View>
                      <Text variant="body" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
                        {label}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={palette.muted2} />
                    </Pressable>
                  );
                })}
              </Card>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flexGrow: 1, justifyContent: 'center' },
  retryBtn: { paddingHorizontal: Spacing.xl },
  groupHeader: { paddingHorizontal: Spacing.xs, letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  iconWrap: { width: 38, height: 38, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});
