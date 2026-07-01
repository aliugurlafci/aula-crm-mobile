import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as ReduxProvider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import { store, persistor } from '@/lib/store';
import { ThemeProvider, useTheme } from '@/lib/theme/ThemeProvider';
import { LanguageProvider } from '@/lib/i18n/LanguageProvider';
import { AuthProvider, useAuth } from '@/lib/auth/AuthProvider';
import { SyncProvider } from '@/lib/sync/SyncProvider';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { status } = useAuth();
  const { isDark } = useTheme();

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync().catch(() => {});
  }, [status]);

  if (status === 'loading') return null;

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="product/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="cart/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="returns/new" options={{ presentation: 'card' }} />
        <Stack.Screen name="labels" options={{ presentation: 'card' }} />
        <Stack.Screen name="outbox" options={{ presentation: 'card' }} />
        <Stack.Screen name="settings" options={{ presentation: 'card' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ReduxProvider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <ThemeProvider>
              <LanguageProvider>
                <AuthProvider>
                  <SyncProvider>
                    <RootNavigator />
                  </SyncProvider>
                </AuthProvider>
              </LanguageProvider>
            </ThemeProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </PersistGate>
    </ReduxProvider>
  );
}
