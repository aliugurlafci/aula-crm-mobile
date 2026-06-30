/**
 * Settings — profile, appearance (glass theme), backend connection, the offline
 * sync queue (review/retry/discard queued sales), an access overview reflecting
 * the user's backend grants, and sign-out.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/lib/auth/AuthProvider';
import { useSync } from '@/lib/sync/SyncProvider';
import { getBaseUrl, setBaseUrl } from '@/lib/api/client';
import { clearLocalData } from '@/lib/db/database';
import { initials, relativeTime } from '@/lib/format';
import type { OutboxRow } from '@/lib/types';
import { useTheme, type ThemeMode } from '@/lib/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n/LanguageProvider';
import { LANGUAGES, LANGUAGE_LABELS, statusKey, type TKey } from '@/lib/i18n/translations';
import { Radius, Spacing } from '@/lib/theme/tokens';
import { Screen } from '@/components/Screen';
import { Card, Input, Button, Text, Badge, Banner, IconButton } from '@/components/ui';

const THEME_MODES: { key: ThemeMode; labelKey: TKey; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'system', labelKey: 'settings.theme.system', icon: 'phone-portrait-outline' },
  { key: 'light', labelKey: 'settings.theme.light', icon: 'sunny-outline' },
  { key: 'dark', labelKey: 'settings.theme.dark', icon: 'moon-outline' },
];

const CAPABILITIES: { action: string; labelKey: TKey }[] = [
  { action: 'pos:checkout', labelKey: 'settings.cap.pos' },
  { action: 'cart:create', labelKey: 'settings.cap.cart' },
  { action: 'salesReturn:create', labelKey: 'settings.cap.returns' },
  { action: 'product:read', labelKey: 'settings.cap.stock' },
  { action: 'labelTemplate:read', labelKey: 'settings.cap.labels' },
];

const QUEUE_KEYS: Record<string, TKey> = {
  'pos.checkout': 'queue.pos.checkout',
  'cart.create': 'queue.cart.create',
  'cart.checkout': 'queue.cart.checkout',
  'return.create': 'queue.return.create',
  'return.post': 'queue.return.post',
};

export default function SettingsScreen() {
  const router = useRouter();
  const { palette, mode, setMode } = useTheme();
  const { lang, setLang, t } = useI18n();
  const { me, grants, can, logout, offline } = useAuth();
  const { online, counts, sync, syncing, retryFailed, discardFailed, listRecent } = useSync();

  const [server, setServer] = useState(getBaseUrl());
  const [editingServer, setEditingServer] = useState(false);
  const [recent, setRecent] = useState<OutboxRow[]>([]);

  const loadRecent = useCallback(async () => setRecent(await listRecent(20)), [listRecent]);
  useEffect(() => {
    void loadRecent();
  }, [loadRecent, counts]);

  const saveServer = async () => {
    await setBaseUrl(server);
    setServer(getBaseUrl());
    setEditingServer(false);
    Alert.alert(t('settings.savedTitle'), t('settings.savedMessage'));
  };

  const confirmLogout = () =>
    Alert.alert(t('settings.signOut'), t('settings.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.signOut'),
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);

  const confirmClear = () =>
    Alert.alert(t('settings.clearTitle'), t('settings.clearMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.clear'),
        style: 'destructive',
        onPress: async () => {
          await clearLocalData();
          void sync('after-clear');
          void loadRecent();
        },
      },
    ]);

  return (
    <Screen title={t('settings.title')} back showSync={false}>
      <ScrollView contentContainerStyle={{ gap: Spacing.md, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* profile */}
        <Card>
          <View style={styles.profile}>
            <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
              <Text variant="subtitle" weight="heavy" style={{ color: '#fff' }}>
                {initials(me?.displayName ?? '?')}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="subtitle" weight="bold">
                {me?.displayName ?? t('settings.user')}
              </Text>
              <Text variant="caption" tone="muted">
                {me?.email}
              </Text>
              <View style={styles.roles}>
                {(me?.roles ?? []).map((r) => (
                  <Badge key={r} tone="primary" label={r.replace(/_/g, ' ')} />
                ))}
              </View>
            </View>
          </View>
          {offline ? <Banner tone="info" message={t('settings.offlineProfile')} /> : null}
        </Card>

        {/* appearance */}
        <Card style={{ gap: Spacing.sm }}>
          <Text variant="subtitle" weight="bold">
            {t('settings.appearance')}
          </Text>
          <View style={styles.segment}>
            {THEME_MODES.map((m) => {
              const active = mode === m.key;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => setMode(m.key)}
                  style={[styles.segItem, { borderColor: active ? palette.primary : palette.border, backgroundColor: active ? palette.primary + '18' : 'transparent' }]}
                >
                  <Ionicons name={m.icon} size={18} color={active ? palette.primary : palette.muted} />
                  <Text variant="caption" tone={active ? 'primary' : 'muted'} weight="semibold">
                    {t(m.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* language */}
        <Card style={{ gap: Spacing.sm }}>
          <Text variant="subtitle" weight="bold">
            {t('settings.language')}
          </Text>
          <View style={styles.segment}>
            {LANGUAGES.map((l) => {
              const active = lang === l;
              return (
                <Pressable
                  key={l}
                  onPress={() => setLang(l)}
                  style={[styles.segItem, { borderColor: active ? palette.primary : palette.border, backgroundColor: active ? palette.primary + '18' : 'transparent' }]}
                >
                  <Text variant="caption" tone={active ? 'primary' : 'muted'} weight="semibold">
                    {LANGUAGE_LABELS[l]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* connection */}
        <Card style={{ gap: Spacing.sm }}>
          <View style={styles.cardHeader}>
            <Text variant="subtitle" weight="bold">
              {t('settings.backend')}
            </Text>
            <Badge tone={online ? 'success' : 'warning'} label={online ? t('common.online') : t('common.offline')} />
          </View>
          {editingServer ? (
            <>
              <Input value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} keyboardType="url" icon="server-outline" />
              <View style={styles.rowBtns}>
                <View style={{ flex: 1 }}>
                  <Button title={t('common.save')} icon="checkmark" onPress={saveServer} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title={t('common.cancel')} variant="ghost" onPress={() => setEditingServer(false)} />
                </View>
              </View>
            </>
          ) : (
            <Pressable onPress={() => setEditingServer(true)} style={styles.linkRow}>
              <Text variant="body" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
                {getBaseUrl()}
              </Text>
              <Ionicons name="create-outline" size={18} color={palette.muted} />
            </Pressable>
          )}
        </Card>

        {/* sync queue */}
        <Card style={{ gap: Spacing.sm }}>
          <View style={styles.cardHeader}>
            <Text variant="subtitle" weight="bold">
              {t('settings.syncQueue')}
            </Text>
            <Button title={t('settings.syncNow')} variant="ghost" size="sm" icon="sync" loading={syncing} onPress={() => sync('manual')} />
          </View>
          <View style={styles.counts}>
            <Count label={t('settings.queued')} value={counts.pending} tone="info" />
            <Count label={t('settings.failed')} value={counts.failed} tone="danger" />
            <Count label={t('settings.synced')} value={counts.done} tone="success" />
          </View>
          {recent.length === 0 ? (
            <Text variant="caption" tone="muted">
              {t('settings.noSales')}
            </Text>
          ) : (
            recent.map((row) => (
              <View key={row.id} style={[styles.queueRow, { borderTopColor: palette.border }]}>
                <View style={{ flex: 1 }}>
                  <Text variant="label">{QUEUE_KEYS[row.kind] ? t(QUEUE_KEYS[row.kind]) : row.kind}</Text>
                  <Text variant="caption" tone="muted">
                    {relativeTime(row.createdAt, lang)}
                    {row.lastError ? ` · ${row.lastError}` : ''}
                  </Text>
                </View>
                <Badge tone={statusTone(row.status)} label={statusKey(row.status) ? t(statusKey(row.status)!) : row.status} />
                {row.status === 'failed' ? (
                  <>
                    <IconButton icon="refresh" size={32} onPress={() => retryFailed(row.id)} />
                    <IconButton icon="trash-outline" size={32} tint="danger" onPress={() => discardFailed(row.id)} />
                  </>
                ) : null}
              </View>
            ))
          )}
        </Card>

        {/* access overview */}
        <Card style={{ gap: Spacing.sm }}>
          <Text variant="subtitle" weight="bold">
            {t('settings.access')}
          </Text>
          <Text variant="caption" tone="muted">
            {t('settings.accessSummary', { grants: grants.length, screens: me?.screens?.length ?? 0 })}
          </Text>
          {CAPABILITIES.map((c) => {
            const ok = can(c.action);
            return (
              <View key={c.action} style={styles.capRow}>
                <Text variant="body">{t(c.labelKey)}</Text>
                <Ionicons name={ok ? 'checkmark-circle' : 'close-circle'} size={20} color={ok ? palette.success : palette.muted2} />
              </View>
            );
          })}
        </Card>

        <Button title={t('settings.clearData')} variant="outline" icon="trash-bin-outline" onPress={confirmClear} />
        <Button title={t('settings.signOut')} variant="danger" icon="log-out-outline" onPress={confirmLogout} />
      </ScrollView>
    </Screen>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone: 'info' | 'danger' | 'success' }) {
  const { palette } = useTheme();
  const color = tone === 'danger' ? palette.danger : tone === 'success' ? palette.success : palette.info;
  return (
    <View style={[styles.count, { backgroundColor: color + '14', borderColor: color + '40' }]}>
      <Text variant="title" weight="heavy" style={{ color }}>
        {value}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

function statusTone(status: string): 'info' | 'danger' | 'success' | 'warning' {
  if (status === 'done') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'syncing') return 'warning';
  return 'info';
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  roles: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap', marginTop: 4 },
  segment: { flexDirection: 'row', gap: Spacing.sm },
  segItem: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rowBtns: { flexDirection: 'row', gap: Spacing.sm },
  counts: { flexDirection: 'row', gap: Spacing.sm },
  count: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, gap: 2 },
  queueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  capRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
});
