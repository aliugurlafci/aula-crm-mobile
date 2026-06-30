/**
 * Sync queue detail — the full durable outbox of sales mutations, opened from the
 * Home "Queued sales" / "Synced" KPIs (and deep-linkable with `?status=`). Filter
 * by state, retry or discard failed rows. Read-only mirror of the settings queue
 * card, with theme + language support.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { useSync } from '@/lib/sync/SyncProvider';
import { relativeTime } from '@/lib/format';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n/LanguageProvider';
import { statusKey, queueKey, type TKey } from '@/lib/i18n/translations';
import { Spacing, Radius } from '@/lib/theme/tokens';
import type { OutboxRow, OutboxStatus } from '@/lib/types';
import { Screen } from '@/components/Screen';
import { Card, Text, Badge, IconButton, EmptyState } from '@/components/ui';

type Filter = 'all' | OutboxStatus;

const FILTERS: { key: Filter; labelKey: TKey }[] = [
  { key: 'all', labelKey: 'outbox.filter.all' },
  { key: 'pending', labelKey: 'settings.queued' },
  { key: 'failed', labelKey: 'settings.failed' },
  { key: 'done', labelKey: 'settings.synced' },
];

function statusTone(status: OutboxStatus): 'info' | 'danger' | 'success' | 'warning' {
  if (status === 'done') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'syncing') return 'warning';
  return 'info';
}

export default function OutboxScreen() {
  const { palette } = useTheme();
  const { t, lang } = useI18n();
  const { counts, listRecent, retryFailed, discardFailed } = useSync();
  const params = useLocalSearchParams<{ status?: string }>();

  const initial: Filter =
    params.status === 'pending' || params.status === 'failed' || params.status === 'done' ? params.status : 'all';
  const [filter, setFilter] = useState<Filter>(initial);
  const [rows, setRows] = useState<OutboxRow[]>([]);

  const load = useCallback(async () => setRows(await listRecent(100)), [listRecent]);
  useEffect(() => {
    void load();
  }, [load, counts]);

  const tr = (key: TKey | null, fallback: string) => (key ? t(key) : fallback);
  const visible = useMemo(() => (filter === 'all' ? rows : rows.filter((r) => r.status === filter)), [rows, filter]);

  return (
    <Screen title={t('outbox.title')} subtitle={t('outbox.subtitle')} back showSync={false}>
      <View style={styles.segment}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.segItem, { borderColor: active ? palette.primary : palette.border, backgroundColor: active ? palette.primary + '18' : 'transparent' }]}
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
        contentContainerStyle={{ paddingBottom: 40, gap: Spacing.sm }}
        data={visible}
        keyExtractor={(r) => r.id}
        ListEmptyComponent={<EmptyState icon="cloud-done-outline" title={t('outbox.empty')} hint={t('outbox.emptyHint')} />}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="body" weight="semibold">
                  {tr(queueKey(item.kind), item.kind)}
                </Text>
                <Text variant="caption" tone="muted">
                  {relativeTime(item.createdAt, lang)}
                  {item.attempts > 0 ? ` · ${t('outbox.attempts', { count: item.attempts })}` : ''}
                </Text>
                {item.lastError ? (
                  <Text variant="caption" tone="danger" numberOfLines={2}>
                    {item.lastError}
                  </Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: Spacing.sm }}>
                <Badge tone={statusTone(item.status)} label={tr(statusKey(item.status), item.status)} />
                {item.status === 'failed' ? (
                  <View style={styles.actions}>
                    <IconButton icon="refresh" size={32} onPress={() => retryFailed(item.id)} />
                    <IconButton icon="trash-outline" size={32} tint="danger" onPress={() => discardFailed(item.id)} />
                  </View>
                ) : null}
              </View>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  actions: { flexDirection: 'row', gap: Spacing.xs },
});
