/**
 * Generic host for the non-entity catalog screens: dashboards + aggregate views
 * render KPI tiles from GET /stats, and the Activity screen renders the recent
 * activity feed from GET /activity. Which one is decided by the client screen
 * registry. Gated by the mobile screen-config like every other destination.
 */
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { stats, activity, type StatsResponse, type ActivityEntry } from '@/lib/api/endpoints';
import { ApiRequestError } from '@/lib/api/client';
import { useI18n } from '@/lib/i18n/LanguageProvider';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { money, relativeTime } from '@/lib/format';
import { Spacing } from '@/lib/theme/tokens';
import { targetForKey } from '@/lib/screens/registry';
import { prettyKey } from '@/lib/screens/record';
import { Screen } from '@/components/Screen';
import { Card, KpiTile, Text, Badge, Button, EmptyState } from '@/components/ui';
import { ScreenGate } from '@/lib/access';

type LoadState = 'loading' | 'idle' | 'offline' | 'error';

export default function GenericHostRoute() {
  const { key, title, screen } = useLocalSearchParams<{ key: string; title?: string; screen?: string }>();
  const k = String(key);
  return (
    <ScreenGate screen={screen ?? k} title={title}>
      {targetForKey(k).kind === 'activity' ? <ActivityView title={title} /> : <DashboardView title={title} />}
    </ScreenGate>
  );
}

function DashboardView({ title }: { title?: string }) {
  const { palette } = useTheme();
  const { t } = useI18n();
  const [data, setData] = useState<StatsResponse | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await stats.get();
      setData(res);
      setState('idle');
    } catch (e) {
      setState(e instanceof ApiRequestError && e.isNetwork ? 'offline' : 'error');
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

  if (state !== 'idle' || !data) {
    return (
      <Screen title={title || t('screen.reports')} back>
        <StatusBlock state={state} onRetry={load} />
      </Screen>
    );
  }

  const stages = Object.entries(data.pipelineByStage ?? {});
  return (
    <Screen title={title || t('screen.reports')} back>
      <ScrollView
        contentContainerStyle={{ gap: Spacing.md, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
      >
        <View style={styles.kpis}>
          <KpiTile icon="people" label={t('dash.accounts')} value={String(data.counts?.account ?? 0)} tone="primary" />
          <KpiTile icon="briefcase" label={t('dash.deals')} value={String(data.counts?.deal ?? 0)} tone="info" />
        </View>
        <View style={styles.kpis}>
          <KpiTile icon="cash" label={t('dash.openPipeline')} value={money(data.openPipeline ?? 0, 'USD')} tone="warning" />
          <KpiTile icon="trophy" label={t('dash.won')} value={money(data.wonValue ?? 0, 'USD')} tone="success" />
        </View>

        <Card style={{ gap: Spacing.sm }}>
          <Text variant="subtitle" weight="bold">
            {t('dash.byStage')}
          </Text>
          {stages.length === 0 ? (
            <Text variant="body" tone="muted">
              {t('dash.empty')}
            </Text>
          ) : (
            stages.map(([stage, agg], i) => (
              <View key={stage} style={[styles.stageRow, i > 0 && { borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <Text variant="body" weight="semibold" style={{ flex: 1 }}>
                  {prettyKey(stage)}
                </Text>
                <Badge tone="info" label={String(agg.count)} />
                <Text variant="body" tone="muted">
                  {money(agg.value, 'USD')}
                </Text>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function ActivityView({ title }: { title?: string }) {
  const { palette } = useTheme();
  const { t, lang } = useI18n();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await activity.list(30);
      setEntries(res.entries);
      setState('idle');
    } catch (e) {
      setState(e instanceof ApiRequestError && e.isNetwork ? 'offline' : 'error');
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

  const label = (e: ActivityEntry): string =>
    e.summary?.trim() || [e.action, e.entity].filter(Boolean).map(String).join(' · ') || t('feed.event');

  return (
    <Screen title={title || t('screen.activity')} back>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40, gap: Spacing.sm, flexGrow: 1 }}
        data={state === 'idle' ? entries : []}
        keyExtractor={(e, i) => `${String(e.recordId ?? '')}:${i}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
        ListEmptyComponent={
          state === 'idle' ? (
            <EmptyState icon="pulse-outline" title={t('feed.empty')} />
          ) : (
            <StatusBlock state={state} onRetry={load} />
          )
        }
        renderItem={({ item }) => (
          <Card padded={false}>
            <View style={styles.feedRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="body" weight="semibold" numberOfLines={2}>
                  {label(item)}
                </Text>
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {item.actorName ?? t('feed.system')}
                  {item.at ? ` · ${relativeTime(String(item.at), lang)}` : ''}
                </Text>
              </View>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

/** Shared loading / offline / error placeholder with a retry action. */
function StatusBlock({ state, onRetry }: { state: LoadState; onRetry: () => void }) {
  const { t } = useI18n();
  if (state === 'loading') {
    return (
      <View style={styles.center}>
        <EmptyState icon="hourglass-outline" title={t('common.loading')} />
      </View>
    );
  }
  return (
    <View style={styles.center}>
      <EmptyState
        icon={state === 'offline' ? 'cloud-offline-outline' : 'alert-circle-outline'}
        title={state === 'offline' ? t('entity.offline') : t('dash.loadError')}
        hint={state === 'offline' ? t('entity.offlineHint') : undefined}
      />
      <View style={styles.retryBtn}>
        <Button title={t('common.retry')} variant="outline" icon="refresh" onPress={onRetry} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  kpis: { flexDirection: 'row', gap: Spacing.md },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  feedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  center: { flex: 1, justifyContent: 'center' },
  retryBtn: { paddingHorizontal: Spacing.xl },
});
