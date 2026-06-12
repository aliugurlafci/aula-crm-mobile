/**
 * Permission logic ported 1:1 from the backend so the mobile UI gates exactly
 * like the server enforces:
 *   - grant strings are `entity:verb` with wildcards (`*`, `entity:*`, `*:verb`)
 *     — see Backend/src/lib/permissions/policies.ts `grantMatches`.
 *   - `can()` performs the RBAC layer (object/action) the web Frontend uses to
 *     show/hide create/update/delete buttons (permissionEngine.can RBAC level).
 *     Record-level ABAC ownership is enforced server-side on mutation; the client
 *     only needs RBAC + the special grants (pos:checkout, pii:read) to gate UI.
 *
 * The authoritative grant list comes from GET /auth/me (`grants`). The ROLES
 * table below mirrors the backend defaults and is the fallback when grants are
 * unavailable (e.g. an offline relaunch before /auth/me refreshes).
 */

/** Does a single grant cover an `entity:verb` action? (verbatim from backend) */
export function grantMatches(grant: string, action: string): boolean {
  if (grant === '*' || grant === action) return true;
  const [gEntity, gVerb] = grant.split(':');
  const [aEntity, aVerb] = action.split(':');
  if (gVerb === '*' && gEntity === aEntity) return true;
  if (gEntity === '*' && gVerb === aVerb) return true;
  return false;
}

/** RBAC check: do these grants permit `action` (an `entity:verb` string)? */
export function can(grants: readonly string[] | Set<string>, action: string): boolean {
  const list = grants instanceof Set ? [...grants] : grants;
  return list.some((g) => grantMatches(g, action));
}

/** Convenience: can the user perform `verb` on `entity`. */
export function canEntity(grants: readonly string[] | Set<string>, entity: string, verb: string): boolean {
  return can(grants, `${entity}:${verb}`);
}

/** True when grants let the holder act on records they don't own (manager-level). */
export function canManageAny(grants: readonly string[] | Set<string>, entity: string): boolean {
  const list = grants instanceof Set ? [...grants] : grants;
  return list.includes('*') || list.includes(`${entity}:*`);
}

/** Verbs that mutate a record (backend MUTATING_VERBS). */
export const MUTATING_VERBS = new Set(['update', 'delete', 'win', 'lose', 'convert']);

/** Default grants per base role — mirrors Backend/src/lib/permissions/policies.ts. */
export const ROLE_GRANTS: Record<string, string[]> = {
  admin: ['*', 'pii:read'],
  sales_manager: [
    'account:*', 'deal:*', 'task:*', 'product:*', 'quote:*', 'quoteLine:*',
    'invoice:*', 'invoiceLine:*', 'payment:*', 'salesOrder:*', 'cart:*', 'cartLine:*',
    'salesReturn:*', 'salesReturnLine:*', 'branch:*', 'dealer:*', 'warehouse:*',
    'supplier:*', 'stockMovement:read', 'purchaseOrder:*', 'goodsReceipt:*',
    'stockTransfer:*', 'stockAdjustment:*', 'labelTemplate:*', 'posSession:*',
    'pos:checkout', 'pii:read',
  ],
  sales_rep: [
    'account:read', 'deal:read', 'deal:create', 'deal:update', 'task:read', 'task:create',
    'task:update', 'product:read', 'quote:read', 'quoteLine:read', 'salesOrder:read',
    'salesOrder:create', 'salesOrder:update', 'cart:*', 'cartLine:*', 'salesReturn:read',
    'salesReturn:create', 'salesReturn:update', 'salesReturn:post', 'salesReturnLine:*',
    'branch:read', 'dealer:read', 'dealer:create', 'dealer:update', 'warehouse:read',
    'stockMovement:read', 'labelTemplate:read', 'posSession:*', 'pos:checkout',
  ],
  accountant: [
    'account:read', 'deal:read', 'product:*', 'currency:*', 'taxRate:*', 'quote:*',
    'quoteLine:*', 'invoice:*', 'invoiceLine:*', 'payment:*', 'salesOrder:read',
    'salesReturn:read', 'branch:read', 'dealer:read', 'warehouse:read', 'supplier:read',
    'stockMovement:read', 'purchaseOrder:read', 'goodsReceipt:read', 'labelTemplate:read',
    'posSession:read', 'pii:read',
  ],
  warehouse_manager: [
    'product:*', 'warehouse:*', 'supplier:*', 'stockMovement:read', 'purchaseOrder:*',
    'goodsReceipt:*', 'stockTransfer:*', 'stockAdjustment:*', 'labelTemplate:*',
    'branch:read', 'dealer:read', 'account:read',
  ],
  system: ['*', 'pii:read'],
};

/** Union of default grants for a set of roles (fallback when /auth/me lacks grants). */
export function grantsForRoles(roles: readonly string[]): string[] {
  const set = new Set<string>();
  for (const role of roles) for (const g of ROLE_GRANTS[role] ?? []) set.add(g);
  return [...set];
}

/** Is a navigable screen (by key) in the user's allowed screen list? */
export function hasScreen(screens: readonly string[] | undefined, key: string): boolean {
  if (!screens) return false;
  return screens.includes(key);
}
