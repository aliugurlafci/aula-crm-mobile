/**
 * Floating glass bottom tab bar. Tabs are filtered by the same permission grants
 * the backend enforces (a cashier without `pos:checkout` never sees the Sell
 * tab, etc.). Active tab uses the CRMS red accent.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useAuth } from '@/lib/auth/AuthProvider';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { Radius, Spacing } from '@/lib/theme/tokens';
import { Glass } from '@/components/ui/Glass';
import { Text } from '@/components/ui/Text';

interface TabMeta {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  /** Show only when the session can perform this action (undefined = always). */
  allow?: (can: (a: string) => boolean) => boolean;
}

const TABS: Record<string, TabMeta> = {
  home: { label: 'Home', icon: 'grid-outline', iconActive: 'grid' },
  pos: { label: 'Sell', icon: 'cart-outline', iconActive: 'cart', allow: (can) => can('pos:checkout') },
  cart: { label: 'Carts', icon: 'bookmarks-outline', iconActive: 'bookmarks', allow: (can) => can('cart:read') || can('cart:create') },
  returns: { label: 'Returns', icon: 'arrow-undo-outline', iconActive: 'arrow-undo', allow: (can) => can('salesReturn:read') },
  stock: {
    label: 'Stock',
    icon: 'cube-outline',
    iconActive: 'cube',
    allow: (can) => can('product:read') || can('warehouse:read') || can('stockMovement:read'),
  },
};

/** Minimal shape of the props expo-router's Tabs passes to a custom tabBar. */
interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (event: { type: 'tabPress'; target: string; canPreventDefault: boolean }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}

export function GlassTabBar({ state, navigation }: TabBarProps) {
  const { palette } = useTheme();
  const { can } = useAuth();
  const insets = useSafeAreaInsets();

  const routes = state.routes.filter((route) => {
    const meta = TABS[route.name];
    if (!meta) return false;
    return meta.allow ? meta.allow(can) : true;
  });

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom || Spacing.md }]} pointerEvents="box-none">
      <Glass strong radius={Radius.xl} style={styles.bar}>
        {routes.map((route) => {
          const meta = TABS[route.name];
          const focused = state.routes[state.index]?.key === route.key;
          const color = focused ? palette.primary : palette.muted;
          return (
            <Pressable
              key={route.key}
              style={styles.tab}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
            >
              <View style={[styles.iconWrap, focused && { backgroundColor: palette.primary + '1F' }]}>
                <Ionicons name={focused ? meta.iconActive : meta.icon} size={22} color={color} />
              </View>
              <Text variant="caption" style={{ color, fontWeight: focused ? '700' : '500' }}>
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.lg },
  bar: { flexDirection: 'row', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4 },
  iconWrap: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: Radius.pill },
});
