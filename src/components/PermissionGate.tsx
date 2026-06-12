/**
 * Renders children only when the current session is granted `action` (an
 * `entity:verb` string) — mirrors how the web Frontend hides create/update/delete
 * controls via permissionEngine.can. Optionally also requires a screen key.
 */
import { useAuth } from '@/lib/auth/AuthProvider';

export function PermissionGate({
  action,
  screen,
  fallback = null,
  children,
}: {
  action?: string;
  screen?: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { can, hasScreen } = useAuth();
  const ok = (action ? can(action) : true) && (screen ? hasScreen(screen) : true);
  return <>{ok ? children : fallback}</>;
}
