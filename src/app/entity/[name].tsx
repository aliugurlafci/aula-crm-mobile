/**
 * Generic entity browser — renders any metadata entity's list from
 * GET /entities/:name, so every catalog screen an admin enables for mobile has a
 * real destination. Search, paginate and tap through to the generic detail view.
 * Gated by the mobile screen-config (ScreenGate) and the user's `entity:read`
 * grant; offline it shows a reconnect prompt (only the POS catalogue is cached).
 */
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { entities } from '@/lib/api/endpoints';
import { ApiRequestError } from '@/lib/api/client';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useI18n } from '@/lib/i18n/LanguageProvider';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { Spacing } from '@/lib/theme/tokens';
import type { EntityRecord } from '@/lib/types';
import { recordTitle, recordBadge, recordSubtitle } from '@/lib/screens/record';
import { Screen } from '@/components/Screen';
import { Card, Input, Badge, Text, EmptyState, Button } from '@/components/ui';
import { ScreenGate } from '@/lib/access';

const PAGE_SIZE = 30;
type LoadState = 'loading' | 'idle' | 'offline' | 'error' | 'forbidden';

export default function EntityListRoute() {
  const { name, title, screen } = useLocalSearchParams<{ name: string; title?: string; screen?: string }>();
  const entity = String(name);
  return (
    <ScreenGate screen={screen ?? entity} title={title}>
      <EntityList entity={entity} title={title} />
    </ScreenGate>
  );
}

function EntityList({ entity, title }: { entity: string; title?: string }) {
  const router = useRouter();
  const { palette } = useTheme();
  const { t, lang } = useI18n();
  const { can } = useAuth();

  const canRead = can(`${entity}:read`);
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 250);
  const [rows, setRows] = useState<EntityRecord[]>([]);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<LoadState>(canRead ? 'loading' : 'forbidden');
  const [refreshing, setRefreshing] = useState(false);

  const fetchPage = useCallback(
    async (nextPage: number, append: boolean) => {
      if (!canRead) {
        setState('forbidden');
        return;
      }
      try {
        const res = await entities.list(entity, {
          q: debounced.trim() || undefined,
          page: nextPage,
          pageSize: PAGE_SIZE,
        });
        setTotal(res.total);
        setPage(nextPage);
        setRows((prev) => (append ? [...prev, ...res.items] : res.items));
        setState('idle');
      } catch (e) {
        if (e instanceof ApiRequestError && e.isNetwork) setState('offline');
        else setState('error');
      }
    },
    [entity, debounced, canRead],
  );

  useEffect(() => {
    setState(canRead ? 'loading' : 'forbidden');
    void fetchPage(1, false);
  }, [fetchPage, canRead]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPage(1, false);
    setRefreshing(false);
  }, [fetchPage]);

  const canLoadMore = state === 'idle' && rows.length > 0 && (total == null || rows.length < total);
  const onEndReached = () => {
    if (canLoadMore) void fetchPage(page + 1, true);
  };

  const headerTitle = title || entity;
  const subtitle =
    state === 'idle' ? t('entity.count', { n: total ?? rows.length }) : undefined;

  const retry = () => void fetchPage(1, false);
  const empty = () => {
    if (state === 'loading') return <EmptyState icon="hourglass-outline" title={t('common.loading')} />;
    if (state === 'forbidden') return <EmptyState icon="lock-closed-outline" title={t('entity.noPermission')} />;
    if (state === 'offline')
      return <RetryBlock icon="cloud-offline-outline" title={t('entity.offline')} hint={t('entity.offlineHint')} label={t('common.retry')} onRetry={retry} />;
    if (state === 'error')
      return <RetryBlock icon="alert-circle-outline" title={t('entity.loadError')} label={t('common.retry')} onRetry={retry} />;
    return <EmptyState icon="file-tray-outline" title={t('entity.empty')} hint={t('entity.emptyHint')} />;
  };

  return (
    <Screen title={headerTitle} subtitle={subtitle} back>
      {canRead ? (
        <Input
          icon="search"
          placeholder={t('entity.searchPlaceholder')}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
      ) : null}
      <FlatList
        style={{ flex: 1, marginTop: Spacing.sm }}
        contentContainerStyle={{ paddingBottom: 40, gap: Spacing.sm, flexGrow: 1 }}
        data={rows}
        keyExtractor={(r, i) => `${String(r.id ?? i)}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
        onEndReachedThreshold={0.4}
        onEndReached={onEndReached}
        ListEmptyComponent={empty()}
        renderItem={({ item }) => {
          const badge = recordBadge(item);
          const sub = recordSubtitle(item, lang);
          return (
            <Pressable
              onPress={() =>
                router.push(`/entity/${entity}/${String(item.id)}?title=${encodeURIComponent(recordTitle(item))}`)
              }
            >
              <Card padded={false}>
                <View style={styles.row}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="body" weight="semibold" numberOfLines={1}>
                      {recordTitle(item)}
                    </Text>
                    {sub ? (
                      <Text variant="caption" tone="muted" numberOfLines={1}>
                        {sub}
                      </Text>
                    ) : null}
                  </View>
                  {badge ? <Badge tone="primary" label={badge} /> : null}
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

/** Centered empty state with a retry action (offline / load error). */
function RetryBlock({
  icon,
  title,
  hint,
  label,
  onRetry,
}: {
  icon: 'cloud-offline-outline' | 'alert-circle-outline';
  title: string;
  hint?: string;
  label: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.retryWrap}>
      <EmptyState icon={icon} title={title} hint={hint} />
      <View style={styles.retryBtn}>
        <Button title={label} variant="outline" icon="refresh" onPress={onRetry} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  retryWrap: { flexGrow: 1, justifyContent: 'center' },
  retryBtn: { paddingHorizontal: Spacing.xl },
});
