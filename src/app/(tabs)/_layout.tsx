/**
 * Tab navigator with the custom glass tab bar. Unauthenticated users are bounced
 * to /login. The tab bar itself hides tabs the session isn't permitted to use.
 */
import { Redirect, Tabs } from 'expo-router';

import { useAuth } from '@/lib/auth/AuthProvider';
import { GlassTabBar } from '@/components/GlassTabBar';

export default function TabsLayout() {
  const { status } = useAuth();
  if (status === 'unauthenticated') return <Redirect href="/login" />;

  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...(props as unknown as React.ComponentProps<typeof GlassTabBar>)} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="pos" />
      <Tabs.Screen name="cart" />
      <Tabs.Screen name="returns" />
      <Tabs.Screen name="stock" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}
