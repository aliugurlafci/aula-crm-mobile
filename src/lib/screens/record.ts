/**
 * Generic record presentation — since the backend is metadata-driven and the
 * mobile app doesn't ship per-entity field maps, these heuristics pick a sensible
 * title, a status badge and a subtitle for any record, and format field values
 * for the detail view. Shared by the generic entity list + detail screens.
 */
import { money, relativeTime } from '@/lib/format';
import type { Lang } from '@/lib/i18n/translations';

type Rec = Record<string, unknown>;

/** Fields tried, in order, as a record's primary label. */
const TITLE_FIELDS = ['name', 'title', 'subject', 'number', 'displayName', 'label', 'code', 'sku', 'email', 'provider', 'ruleName', 'key', 'firstName'];
/** Fields tried, in order, as a record's status badge. */
const BADGE_FIELDS = ['status', 'stage', 'state', 'type', 'priority', 'folder', 'normalBalance'];
/** Structural/ownership fields hidden from the generic detail view. */
const HIDDEN_FIELDS = new Set(['id', 'version', 'tenantId', 'orgId', 'ownerId', 'createdBy', 'updatedBy', 'searchText', 'searchIndex']);
/** Money-like fields, tried in order for the list subtitle. */
const AMOUNT_FIELDS = ['amount', 'grandTotal', 'total', 'balance', 'unitPrice', 'value'];
/** Date-like fields, tried in order for the list subtitle. */
const DATE_FIELDS = ['createdAt', 'date', 'dueDate', 'closeDate', 'startAt', 'updatedAt'];

const str = (v: unknown): string => (v == null ? '' : String(v)).trim();
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function recordTitle(r: Rec): string {
  for (const f of TITLE_FIELDS) {
    const v = str(r[f]);
    if (v) return f === 'firstName' && str(r.lastName) ? `${v} ${str(r.lastName)}` : v;
  }
  return str(r.id) || '—';
}

export function recordBadge(r: Rec): string | null {
  for (const f of BADGE_FIELDS) {
    const v = str(r[f]);
    if (v) return v;
  }
  return null;
}

export function recordSubtitle(r: Rec, lang: Lang): string | null {
  const parts: string[] = [];
  for (const f of AMOUNT_FIELDS) {
    const n = num(r[f]);
    if (n != null) {
      parts.push(money(n, str(r.currencyCode) || 'USD'));
      break;
    }
  }
  for (const f of DATE_FIELDS) {
    const v = str(r[f]);
    if (v) {
      parts.push(relativeTime(v, lang));
      break;
    }
  }
  return parts.length ? parts.join(' · ') : null;
}

export interface Field {
  key: string;
  value: string;
}

/** Ordered, human-presentable fields for the detail view (hidden ones dropped). */
export function fieldEntries(r: Rec, lang: Lang): Field[] {
  return Object.entries(r)
    .filter(([k, v]) => !HIDDEN_FIELDS.has(k) && v != null && v !== '')
    .map(([k, v]) => ({ key: prettyKey(k), value: formatValue(k, v, lang) }));
}

function formatValue(key: string, value: unknown, lang: Lang): string {
  if (typeof value === 'boolean') return value ? '✓' : '—';
  if (typeof value === 'number') {
    return AMOUNT_FIELDS.includes(key) ? money(value, 'USD') : String(value);
  }
  if (Array.isArray(value)) return value.length ? `${value.length}` : '—';
  if (value && typeof value === 'object') return JSON.stringify(value);
  const s = String(value);
  // ISO-ish timestamps → relative time.
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return relativeTime(s, lang);
  return s;
}

/** camelCase / snake_case field name → "Title Case" label. */
export function prettyKey(key: string): string {
  const spaced = key.replace(/[-_]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
