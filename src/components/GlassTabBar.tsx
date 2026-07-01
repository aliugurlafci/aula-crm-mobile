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
import { useI18n } from '@/lib/i18n/LanguageProvider';
import { useScreenAccess } from '@/lib/access';
import type { TKey } from '@/lib/i18n/translations';
import { Radius, Spacing } from '@/lib/theme/tokens';
import { Glass } from '@/components/ui/Glass';
import { Text } from '@/components/ui/Text';

interface TabMeta {
  labelKey: TKey;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  /** The mobile screen-config key that governs this tab's visibility. */
  screenKey: string;
  /** Show only when the session can perform this action (undefined = always). */
  allow?: (can: (a: string) => boolean) => boolean;
}

const TABS: Record<string, TabMeta> = {
  home: { labelKey: 'tab.home', icon: 'grid-outline', iconActive: 'grid', screenKey: 'home' },
  pos: { labelKey: 'tab.pos', icon: 'cart-outline', iconActive: 'cart', screenKey: 'pos', allow: (can) => can('pos:checkout') },
  cart: { labelKey: 'tab.cart', icon: 'bookmarks-outline', iconActive: 'bookmarks', screenKey: 'cart', allow: (can) => can('cart:read') || can('cart:create') },
  returns: { labelKey: 'tab.returns', icon: 'arrow-undo-outline', iconActive: 'arrow-undo', screenKey: 'salesReturn', allow: (can) => can('salesReturn:read') },
  stock: {
    labelKey: 'tab.stock',
    icon: 'cube-outline',
    iconActive: 'cube',
    screenKey: 'stock-levels',
    allow: (can) => can('product:read') || can('warehouse:read') || can('stockMovement:read'),
  },
  // The "More" hub is always available — it's the gateway to every other screen
  // the admin has enabled for mobile (each row is itself gated inside the hub).
  more: { labelKey: 'tab.more', icon: 'ellipsis-horizontal-circle-outline', iconActive: 'ellipsis-horizontal-circle', screenKey: 'more' },
};

/**
 * Intrinsic height of the floating glass bar (icon + caption + its own padding),
 * excluding the safe-area inset the wrapper adds below it.
 */
export const TAB_BAR_HEIGHT = 72;

/**
 * Vertical space the floating tab bar occupies from the screen's bottom edge
 * (bar height + safe-area inset). Tab screens reserve this much bottom padding so
 * content and floating action bars are never hidden behind the bar.
 */
export function useTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + (insets.bottom || Spacing.md);
}

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
  const { t } = useI18n();
  const { can } = useAuth();
  const { isAllowed } = useScreenAccess();
  const insets = useSafeAreaInsets();

  const routes = state.routes.filter((route) => {
    const meta = TABS[route.name];
    if (!meta) return false;
    // Both gates must pass: the user's backend grants AND the admin's mobile
    // screen-config (an enabled screen the user isn't permitted to still hides).
    if (!isAllowed(meta.screenKey)) return false;
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
                {t(meta.labelKey)}
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
