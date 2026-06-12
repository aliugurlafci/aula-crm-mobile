/**
 * Formatting + small math helpers. Money rounding matches the backend's
 * `round2` (Math.round(n*100)/100) so client totals agree with server totals.
 */
import type { SaleLine } from './types';

export const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  TRY: '₺',
};

export function money(amount: number | null | undefined, currency = 'USD'): string {
  const n = round2(Number(amount) || 0);
  const symbol = CURRENCY_SYMBOLS[currency] ?? '';
  const formatted = n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return symbol ? `${symbol}${formatted}` : `${formatted} ${currency}`;
}

export function qty(n: number | null | undefined): string {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

/** Net line total (qty × unitPrice) before tax. */
export function lineNet(line: Pick<SaleLine, 'qty' | 'unitPrice'>): number {
  return round2((Number(line.qty) || 0) * (Number(line.unitPrice) || 0));
}

/** Tax for a line. */
export function lineTax(line: Pick<SaleLine, 'qty' | 'unitPrice' | 'taxRate'>): number {
  return round2(lineNet(line) * ((Number(line.taxRate) || 0) / 100));
}

/** Gross line total (net + tax). */
export function lineGross(line: SaleLine): number {
  return round2(lineNet(line) + lineTax(line));
}

export interface CartTotals {
  subtotal: number;
  tax: number;
  total: number;
  count: number;
}

export function cartTotals(lines: SaleLine[]): CartTotals {
  let subtotal = 0;
  let tax = 0;
  let count = 0;
  for (const l of lines) {
    subtotal += lineNet(l);
    tax += lineTax(l);
    count += Number(l.qty) || 0;
  }
  subtotal = round2(subtotal);
  tax = round2(tax);
  return { subtotal, tax, total: round2(subtotal + tax), count };
}

/** A short, URL-safe random id (no crypto dependency needed). */
export function uid(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}${time}${rand}`;
}

export function initials(name: string): string {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}
