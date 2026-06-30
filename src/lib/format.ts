/**
 * Formatting + small math helpers. Money rounding matches the backend's
 * `round2` (Math.round(n*100)/100) so client totals agree with server totals.
 */
import type { SaleLine } from './types';
import type { Lang } from './i18n/translations';

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

/** Localised unit strings for `relativeTime`; `{n}` is the count. */
const REL_TIME: Record<Lang, { now: string; min: string; hr: string; day: string }> = {
  en: { now: 'just now', min: '{n}m ago', hr: '{n}h ago', day: '{n}d ago' },
  tr: { now: 'az önce', min: '{n} dk önce', hr: '{n} sa önce', day: '{n} gün önce' },
  de: { now: 'gerade eben', min: 'vor {n} Min.', hr: 'vor {n} Std.', day: 'vor {n} Tg.' },
};

export function relativeTime(iso: string | null | undefined, lang: Lang = 'en'): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const u = REL_TIME[lang] ?? REL_TIME.en;
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return u.now;
  if (min < 60) return u.min.replace('{n}', String(min));
  const hr = Math.round(min / 60);
  if (hr < 24) return u.hr.replace('{n}', String(hr));
  const day = Math.round(hr / 24);
  return u.day.replace('{n}', String(day));
}
