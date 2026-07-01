/**
 * Generic entity detail — renders a single record from GET /entities/:name/:id as
 * a metadata-agnostic field list. Reached from the generic entity browser; gated
 * by the same screen-config + `entity:read` grant.
 */
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { entities } from '@/lib/api/endpoints';
import { ApiRequestError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useI18n } from '@/lib/i18n/LanguageProvider';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { Spacing } from '@/lib/theme/tokens';
import type { EntityRecord } from '@/lib/types';
import { fieldEntries, recordTitle, recordBadge } from '@/lib/screens/record';
import { Screen } from '@/components/Screen';
import { Card, Text, Badge, Button, EmptyState } from '@/components/ui';
import { ScreenGate } from '@/lib/access';

type LoadState = 'loading' | 'idle' | 'offline' | 'error' | 'forbidden' | 'notfound';

export default function EntityDetailRoute() {
  const { name, id, title } = useLocalSearchParams<{ name: string; id: string; title?: string }>();
  const entity = String(name);
  return (
    <ScreenGate screen={entity} title={title}>
      <EntityDetail entity={entity} id={String(id)} title={title} />
    </ScreenGate>
  );
}

function EntityDetail({ entity, id, title }: { entity: string; id: string; title?: string }) {
  const { palette } = useTheme();
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const canRead = can(`${entity}:read`);

  const [record, setRecord] = useState<EntityRecord | null>(null);
  const [state, setState] = useState<LoadState>(canRead ? 'loading' : 'forbidden');

  const load = useCallback(async () => {
    if (!canRead) {
      setState('forbidden');
      return;
    }
    setState('loading');
    try {
      const res = await entities.get<EntityRecord>(entity, id);
      setRecord(res);
      setState('idle');
    } catch (e) {
      if (e instanceof ApiRequestError && e.isNetwork) setState('offline');
      else if (e instanceof ApiRequestError && e.status === 404) setState('notfound');
      else setState('error');
    }
  }, [entity, id, canRead]);

  useEffect(() => {
    void load();
  }, [load]);

  const headerTitle = record ? recordTitle(record) : title || entity;
  const badge = record ? recordBadge(record) : null;
  const fields = record ? fieldEntries(record, lang) : [];

  return (
    <Screen title={headerTitle} back>
      {state === 'idle' && record ? (
        <ScrollView contentContainerStyle={{ gap: Spacing.md, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {badge ? (
            <View style={{ flexDirection: 'row' }}>
              <Badge tone="primary" label={badge} />
            </View>
          ) : null}
          <Card style={{ gap: Spacing.sm }}>
            {fields.map((f, i) => (
              <View key={f.key} style={[styles.fieldRow, i > 0 && { borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <Text variant="caption" tone="muted" style={styles.fieldKey}>
                  {f.key}
                </Text>
                <Text variant="body" style={styles.fieldVal}>
                  {f.value}
                </Text>
              </View>
            ))}
            {fields.length === 0 ? (
              <Text variant="body" tone="muted" center>
                {t('detail.empty')}
              </Text>
            ) : null}
          </Card>
        </ScrollView>
      ) : (
        <View style={styles.center}>
          {state === 'loading' ? <EmptyState icon="hourglass-outline" title={t('common.loading')} /> : null}
          {state === 'forbidden' ? <EmptyState icon="lock-closed-outline" title={t('entity.noPermission')} /> : null}
          {state === 'notfound' ? <EmptyState icon="help-circle-outline" title={t('detail.notFound')} /> : null}
          {state === 'offline' || state === 'error' ? (
            <>
              <EmptyState
                icon={state === 'offline' ? 'cloud-offline-outline' : 'alert-circle-outline'}
                title={state === 'offline' ? t('entity.offline') : t('detail.loadError')}
                hint={state === 'offline' ? t('entity.offlineHint') : undefined}
              />
              <View style={styles.retryBtn}>
                <Button title={t('common.retry')} variant="outline" icon="refresh" onPress={() => void load()} />
              </View>
            </>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  retryBtn: { paddingHorizontal: Spacing.xl },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.sm },
  fieldKey: { flex: 1 },
  fieldVal: { flex: 1.6, textAlign: 'right' },
});
