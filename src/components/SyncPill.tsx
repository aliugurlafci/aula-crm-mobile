/**
 * Compact online/offline + pending-sync indicator shown in screen headers.
 * Tapping it triggers a manual sync.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/lib/theme/ThemeProvider';
import { Radius } from '@/lib/theme/tokens';
import { useSync } from '@/lib/sync/SyncProvider';
import { Text } from '@/components/ui/Text';

export function SyncPill() {
  const { palette } = useTheme();
  const { online, syncing, counts, sync } = useSync();
  const pending = counts.pending;
  const color = !online ? palette.warning : pending > 0 ? palette.info : palette.success;
  const icon = !online ? 'cloud-offline' : syncing ? 'sync' : pending > 0 ? 'cloud-upload' : 'cloud-done';
  const label = !online ? 'Offline' : syncing ? 'Syncing' : pending > 0 ? `${pending} queued` : 'Synced';

  return (
    <Pressable onPress={() => sync('manual')} hitSlop={8}>
      <View style={[styles.pill, { backgroundColor: color + '22', borderColor: color + '55' }]}>
        <Ionicons name={icon} size={13} color={color} />
        <Text variant="caption" style={{ color, fontWeight: '700' }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
