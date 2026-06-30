/**
 * Barcode/QR SVG generation via bwip-js (pure JS, DOM-free `toSVG`). We import
 * the `generic` build rather than the bare package: the default `react-native`
 * export pulls in `react-zlib-js` at module load (for PNG encoding we never use)
 * and that polyfill crashes on init under Hermes. The generic build depends only
 * on bwip-js's own encoders, so it loads cleanly and still provides `toSVG`. We
 * render WITHOUT the built-in human-readable text (includetext:false) to avoid
 * runtime font loading; callers print the caption with their own text.
 */
import bwipjs from 'bwip-js/generic';

import type { BarcodeType } from './check-digit';

const BCID: Record<BarcodeType, string> = {
  ean13: 'ean13',
  upc: 'upca',
  code128: 'code128',
  qr: 'qrcode',
};

export interface BarcodeOptions {
  scale?: number;
  /** Bar height in mm for 1D symbologies (ignored for QR). */
  height?: number;
}

/** Render `value` as an SVG string, or '' if it can't be encoded. */
export function barcodeSvg(value: string, type: BarcodeType, opts: BarcodeOptions = {}): string {
  const text = (value ?? '').trim();
  if (!text) return '';
  try {
    return bwipjs.toSVG({
      bcid: BCID[type] ?? 'code128',
      text,
      scale: opts.scale ?? 3,
      ...(type === 'qr' ? {} : { height: opts.height ?? 12 }),
      includetext: false,
      paddingwidth: 0,
      paddingheight: 0,
    });
  } catch {
    // Fall back to Code 128 for values an EAN/UPC encoder rejects.
    if (type !== 'code128' && type !== 'qr') {
      try {
        return bwipjs.toSVG({ bcid: 'code128', text, scale: opts.scale ?? 3, height: opts.height ?? 12, includetext: false });
      } catch {
        return '';
      }
    }
    return '';
  }
}
