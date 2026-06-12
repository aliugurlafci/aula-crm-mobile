/**
 * Barcode value helpers ported from Backend/src/lib/barcode/check-digit.ts so the
 * mobile app validates + normalises codes identically to the server (the POS
 * `lookup` normalises scans the same way). Rendering is done with bwip-js.
 */
export type BarcodeType = 'ean13' | 'upc' | 'code128' | 'qr';

const digitsOnly = (s: string): boolean => /^[0-9]+$/.test(s);

function gtinCheckDigit(payload: string): number {
  let sum = 0;
  for (let i = payload.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) {
    sum += Number(payload[i]) * w;
  }
  return (10 - (sum % 10)) % 10;
}

export function buildEan13(payload12: string): string {
  if (payload12.length !== 12 || !digitsOnly(payload12)) {
    throw new Error('EAN-13 payload must be exactly 12 digits');
  }
  return payload12 + String(gtinCheckDigit(payload12));
}

export function isValidBarcode(value: string, type: BarcodeType): boolean {
  const v = (value ?? '').trim();
  if (!v) return false;
  switch (type) {
    case 'ean13':
      return v.length === 13 && digitsOnly(v) && Number(v[12]) === gtinCheckDigit(v.slice(0, 12));
    case 'upc':
      return v.length === 12 && digitsOnly(v) && Number(v[11]) === gtinCheckDigit(v.slice(0, 11));
    case 'code128':
      return v.length >= 1 && v.length <= 64 && /^[\x20-\x7e]+$/.test(v);
    case 'qr':
      return v.length >= 1 && v.length <= 2048;
    default:
      return false;
  }
}

/** Deterministic internal EAN-13 from a sequence number (GS1 in-store prefix 20). */
export function internalEan13(seq: number): string {
  const body = String(Math.abs(Math.trunc(seq)) % 10_000_000_000).padStart(10, '0');
  return buildEan13('20' + body);
}

/** Generate a fresh internal EAN-13 (no sequence source on device). */
export function generateInternalBarcode(): string {
  return internalEan13(Math.floor(Math.random() * 1e10));
}

/** Normalise a scanned code: trim (matches backend `normalizeScan`). */
export function normalizeScan(raw: string): string {
  return (raw ?? '').trim();
}

/** Best-effort symbology guess from a raw value (for label rendering). */
export function guessType(value: string): BarcodeType {
  const v = (value ?? '').trim();
  if (/^[0-9]{13}$/.test(v)) return 'ean13';
  if (/^[0-9]{12}$/.test(v)) return 'upc';
  return 'code128';
}
