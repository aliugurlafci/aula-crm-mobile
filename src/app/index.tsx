/**
 * Auth gate — sends authenticated users into the tabs and everyone else to the
 * login screen. Auth hydration happens in the root layout (splash stays up).
 */
import { Redirect } from 'expo-router';

import { useAuth } from '@/lib/auth/AuthProvider';

export default function Index() {
  const { status } = useAuth();
  if (status === 'authenticated') return <Redirect href="/(tabs)/pos" />;
  return <Redirect href="/login" />;
}
