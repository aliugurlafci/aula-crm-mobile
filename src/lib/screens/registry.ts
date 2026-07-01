/**
 * Client screen registry — the mobile counterpart of the backend screen catalog
 * (Backend/src/lib/config/screens.ts). It maps every catalog key an admin can
 * enable for mobile to: an icon, a localized title, and a navigation target.
 *
 * The companion app only ships bespoke screens for the POS core; every other
 * catalog screen is rendered by one of three generic hosts, so enabling a screen
 * in "Settings → Mobile app Screens" now lands on a real, gated destination:
 *   - `bespoke`   → an existing hand-built route (POS, cart, stock, …)
 *   - `entity`    → the generic entity browser  (/entity/[name])
 *   - `dashboard` → the generic stats host       (/screen/[key])
 *   - `activity`  → the recent-activity feed      (/screen/[key])
 *
 * Titles come from a `TKey` for the well-known extra screens (so they localize),
 * and from the server catalog label for entity screens (metadata-driven, like
 * the web). Everything here is pure so it can be shared by the hub, the gate and
 * every generic host without pulling in navigation or store state.
 */
import { Ionicons } from '@expo/vector-icons';
import type { TKey } from '@/lib/i18n/translations';

export type IoniconName = keyof typeof Ionicons.glyphMap;

/** A screen entry from GET /screens (the full web catalog with labels). */
export interface CatalogScreen {
  key: string;
  label: string;
  group: string;
}

/** How a catalog key is realized on mobile. */
export type ScreenTarget =
  | { kind: 'bespoke'; path: string }
  | { kind: 'entity'; entity: string }
  | { kind: 'dashboard' }
  | { kind: 'activity' };

/** Hand-built routes for the POS core (config key → expo-router path). */
const BESPOKE: Record<string, string> = {
  home: '/(tabs)/home',
  pos: '/(tabs)/pos',
  cart: '/(tabs)/cart',
  salesReturn: '/(tabs)/returns',
  'stock-levels': '/(tabs)/stock',
  product: '/(tabs)/stock',
  labels: '/labels',
  'label-designer': '/labels',
  settings: '/settings',
};

/** Non-entity "extra" screens the app renders through a generic host. */
interface ExtraDef {
  icon: IoniconName;
  titleKey: TKey;
  target: ScreenTarget;
}

const EXTRAS: Record<string, ExtraDef> = {
  // Dashboards + aggregate views → the generic stats host.
  'sales-dashboard': { icon: 'trending-up-outline', titleKey: 'screen.salesDashboard', target: { kind: 'dashboard' } },
  'deals-dashboard': { icon: 'briefcase-outline', titleKey: 'screen.dealsDashboard', target: { kind: 'dashboard' } },
  'inventory-dashboard': { icon: 'cube-outline', titleKey: 'screen.inventoryDashboard', target: { kind: 'dashboard' } },
  'accounting-dashboard': { icon: 'calculator-outline', titleKey: 'screen.accountingDashboard', target: { kind: 'dashboard' } },
  'branch-dashboard': { icon: 'business-outline', titleKey: 'screen.branchDashboard', target: { kind: 'dashboard' } },
  'executive-dashboard': { icon: 'podium-outline', titleKey: 'screen.executiveDashboard', target: { kind: 'dashboard' } },
  'revenue-dashboard': { icon: 'cash-outline', titleKey: 'screen.revenueDashboard', target: { kind: 'dashboard' } },
  'growth-dashboard': { icon: 'rocket-outline', titleKey: 'screen.growthDashboard', target: { kind: 'dashboard' } },
  pipeline: { icon: 'git-branch-outline', titleKey: 'screen.pipeline', target: { kind: 'dashboard' } },
  reports: { icon: 'bar-chart-outline', titleKey: 'screen.reports', target: { kind: 'dashboard' } },
  finance: { icon: 'wallet-outline', titleKey: 'screen.finance', target: { kind: 'dashboard' } },
  activity: { icon: 'pulse-outline', titleKey: 'screen.activity', target: { kind: 'activity' } },

  // Comms / admin tools → the generic entity browser over their backing entity.
  email: { icon: 'mail-outline', titleKey: 'screen.email', target: { kind: 'entity', entity: 'email' } },
  calendar: { icon: 'calendar-outline', titleKey: 'screen.calendar', target: { kind: 'entity', entity: 'calendarEvent' } },
  'file-manager': { icon: 'folder-outline', titleKey: 'screen.files', target: { kind: 'entity', entity: 'file' } },
  todo: { icon: 'checkbox-outline', titleKey: 'screen.todo', target: { kind: 'entity', entity: 'todo' } },
  notes: { icon: 'document-text-outline', titleKey: 'screen.notes', target: { kind: 'entity', entity: 'note' } },
  automation: { icon: 'flash-outline', titleKey: 'screen.automation', target: { kind: 'entity', entity: 'automationRule' } },
};

/** Fallback icon per catalog group (used for entity screens). */
const GROUP_ICON: Record<string, IoniconName> = {
  main: 'grid-outline',
  dashboards: 'stats-chart-outline',
  sales: 'cart-outline',
  crm: 'people-outline',
  inventory: 'cube-outline',
  purchasing: 'bag-handle-outline',
  accounting: 'calculator-outline',
  finance: 'wallet-outline',
  people: 'person-outline',
  comms: 'chatbubbles-outline',
  admin: 'construct-outline',
};

/**
 * Screens surfaced elsewhere (bottom tabs / the profile avatar) or that are pure
 * duplicates — excluded from the "More" hub so it doesn't repeat them.
 */
export const HUB_HIDDEN = new Set<string>([
  'home',
  'pos',
  'cart',
  'salesReturn',
  'stock-levels',
  'product',
  'label-designer',
  'settings',
]);

/** Resolve how a catalog key is rendered on mobile. */
export function targetForKey(key: string): ScreenTarget {
  if (BESPOKE[key]) return { kind: 'bespoke', path: BESPOKE[key] };
  const extra = EXTRAS[key];
  if (extra) return extra.target;
  // Anything else is an entity screen (its key is the entity name).
  return { kind: 'entity', entity: key };
}

/** The localized title for a screen (TKey for extras, server label otherwise). */
export function titleForKey(key: string, serverLabel: string | undefined, t: (k: TKey) => string): string {
  const extra = EXTRAS[key];
  if (extra) return t(extra.titleKey);
  return serverLabel ?? prettify(key);
}

/** The icon for a screen row. */
export function iconForKey(key: string, group: string): IoniconName {
  const extra = EXTRAS[key];
  if (extra) return extra.icon;
  return GROUP_ICON[group] ?? 'apps-outline';
}

/**
 * The expo-router href for a screen. `label` is carried as a `title` query param
 * so the generic host can show a meaningful header without a second fetch, and
 * `screen` carries the config key so the destination gates on the right key.
 */
export function hrefForKey(key: string, label: string): string {
  const target = targetForKey(key);
  const q = `title=${encodeURIComponent(label)}&screen=${encodeURIComponent(key)}`;
  switch (target.kind) {
    case 'bespoke':
      return target.path;
    case 'entity':
      return `/entity/${target.entity}?${q}`;
    default:
      return `/screen/${key}?${q}`;
  }
}

/**
 * Client-side permission gate for a hub row. The backend already intersects the
 * admin config with the user's screen grants, but deep-links and the pre-config
 * allow-all window still benefit from an entity-read check.
 */
export function canAccessKey(key: string, can: (action: string) => boolean): boolean {
  const target = targetForKey(key);
  if (target.kind === 'entity') return can(`${target.entity}:read`);
  return true;
}

/** Turn a camelCase / kebab key into a human title as a last resort. */
export function prettify(key: string): string {
  const spaced = key.replace(/[-_]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
