/**
 * Barcode label printing via expo-print. Builds a self-contained HTML page with
 * the bwip-js SVG embedded inline (WKWebView can't load local files, so inline
 * SVG markup is the reliable path) and sends it to the native print dialog or a
 * shareable PDF. Designed for thermal label rolls (default 50×30mm) and A4.
 */
import * as Print from 'expo-print';

import { barcodeSvg } from './generate';
import { guessType, type BarcodeType } from './check-digit';
import { money } from '../format';
import type { Product } from '../types';

export interface LabelSpec {
  title: string;
  priceLabel?: string;
  code: string;
  type?: BarcodeType;
  /** Physical label size in mm. */
  widthMm?: number;
  heightMm?: number;
  copies?: number;
}

function labelCardHtml(spec: LabelSpec): string {
  const type = spec.type ?? guessType(spec.code);
  const svg = barcodeSvg(spec.code, type, { scale: 3, height: 14 });
  const w = spec.widthMm ?? 50;
  const h = spec.heightMm ?? 30;
  return `
    <div class="label" style="width:${w}mm;height:${h}mm;">
      <div class="name">${escapeHtml(spec.title)}</div>
      ${spec.priceLabel ? `<div class="price">${escapeHtml(spec.priceLabel)}</div>` : ''}
      <div class="bc">${svg || `<div class="nobc">${escapeHtml(spec.code)}</div>`}</div>
      <div class="code">${escapeHtml(spec.code)}</div>
    </div>`;
}

export function labelSheetHtml(specs: LabelSpec[]): string {
  const cards = specs
    .flatMap((s) => Array.from({ length: Math.max(1, s.copies ?? 1) }, () => labelCardHtml(s)))
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
      body { margin: 0; padding: 6px; font-family: -apple-system, Roboto, Helvetica, sans-serif; }
      .sheet { display: flex; flex-wrap: wrap; gap: 4mm; }
      .label { border: 1px dashed #cbd5e1; border-radius: 6px; padding: 3mm; display: flex;
               flex-direction: column; align-items: center; justify-content: space-between; overflow: hidden; }
      .name { font-size: 9pt; font-weight: 700; text-align: center; line-height: 1.1;
              max-height: 2.4em; overflow: hidden; }
      .price { font-size: 12pt; font-weight: 800; color: #e41f07; }
      .bc { width: 100%; display: flex; justify-content: center; align-items: center; flex: 1; }
      .bc svg { max-width: 100%; height: auto; }
      .nobc { font-family: monospace; font-size: 10pt; }
      .code { font-family: monospace; font-size: 7pt; letter-spacing: 1px; }
    </style></head>
    <body><div class="sheet">${cards}</div></body></html>`;
}

function escapeHtml(s: string): string {
  return (s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}

export function productToLabel(p: Product, copies = 1): LabelSpec {
  return {
    title: p.name,
    priceLabel: p.unitPrice != null ? money(p.unitPrice, p.currencyCode ?? 'USD') : undefined,
    code: (p.barcode || p.sku || p.id) ?? '',
    copies,
  };
}

/** Open the native print dialog with the given labels. */
export async function printLabels(specs: LabelSpec[]): Promise<void> {
  await Print.printAsync({ html: labelSheetHtml(specs) });
}

/** Render labels to a shareable PDF; returns the file URI. */
export async function labelsToPdf(specs: LabelSpec[]): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html: labelSheetHtml(specs) });
  return uri;
}
