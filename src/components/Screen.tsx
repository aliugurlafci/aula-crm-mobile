/**
 * Standard screen scaffold: aurora background + safe-area + an optional glass
 * header (title, back button, right actions, sync pill). Keeps every screen
 * visually consistent with the web app's frosted header.
 */
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '@/lib/theme/ThemeProvider';
import { Spacing } from '@/lib/theme/tokens';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { SyncPill } from '@/components/SyncPill';

export function Screen({
  title,
  subtitle,
  back,
  right,
  showSync = true,
  padded = true,
  children,
}: {
  title?: string;
  subtitle?: string;
  back?: boolean;
  right?: React.ReactNode;
  showSync?: boolean;
  padded?: boolean;
  children: React.ReactNode;
}) {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <ScreenBackground>
      <View style={{ flex: 1, paddingTop: insets.top }}>
        {(title || back) && (
          <View style={[styles.header, { borderBottomColor: palette.border }]}>
            <View style={styles.headerLeft}>
              {back ? <IconButton icon="chevron-back" size={38} onPress={() => router.back()} /> : null}
              <View style={{ flexShrink: 1 }}>
                {title ? (
                  <Text variant="heading" weight="bold" numberOfLines={1}>
                    {title}
                  </Text>
                ) : null}
                {subtitle ? (
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.headerRight}>
              {right}
              {showSync ? <SyncPill /> : null}
            </View>
          </View>
        )}
        <View style={[{ flex: 1 }, padded && styles.body]}>{children}</View>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    paddingTop: Platform.OS === 'android' ? Spacing.sm : 0,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexShrink: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  body: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
});
