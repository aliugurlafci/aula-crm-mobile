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

/** Normalise a scanned code: trim (matches backend `normalizeScan`). Symbology
 *  equivalence is handled by {@link barcodeCandidates}, not by mutating here. */
export function normalizeScan(raw: string): string {
  return (raw ?? '').trim();
}

/**
 * Expand an 8-digit UPC-E value (number-system + 6 data + check) to its 12-digit
 * UPC-A form. Returns null if the value is not a well-formed UPC-E. The 6 data
 * digits select one of four zero-fill expansions via their last digit.
 */
function expandUpcE(value: string): string | null {
  if (value.length !== 8 || !digitsOnly(value)) return null;
  const ns = value[0];
  if (ns !== '0' && ns !== '1') return null; // UPC-E only carries number system 0/1
  const d = value.slice(1, 7); // X1..X6
  const last = d[5];
  let body: string; // the 10 manufacturer+item digits
  switch (last) {
    case '0':
    case '1':
    case '2':
      body = d.slice(0, 2) + last + '0000' + d.slice(2, 5);
      break;
    case '3':
      body = d.slice(0, 3) + '00000' + d.slice(3, 5);
      break;
    case '4':
      body = d.slice(0, 4) + '00000' + d.slice(4, 5);
      break;
    default: // 5–9
      body = d.slice(0, 5) + '0000' + last;
      break;
  }
  const payload11 = ns + body;
  if (payload11.length !== 11) return null;
  return payload11 + String(gtinCheckDigit(payload11));
}

/**
 * Equivalent representations of a scanned code, most-specific first. The retail
 * GS1 symbologies encode the *same* GTIN at different lengths, and the camera may
 * report either form depending on the platform — e.g. iOS returns a UPC-A as a
 * 13-digit EAN-13 (leading 0) while Android reports 12 digits; UPC-E is the
 * zero-compressed form of a UPC-A. Looking a scan up by ALL of its equivalent
 * forms makes the match robust regardless of which form the product's `barcode`
 * was stored under. Shared verbatim with the backend (`pos.lookup`) so offline
 * (local cache) and online resolution behave identically.
 */
export function barcodeCandidates(raw: string): string[] {
  const c = normalizeScan(raw);
  if (!c) return [];
  const out: string[] = [c];
  const add = (v: string | null | undefined): void => {
    if (v && !out.includes(v)) out.push(v);
  };
  if (digitsOnly(c)) {
    // UPC-A (12) ↔ EAN-13 (13 with a leading 0) — the same GTIN.
    if (c.length === 12) add('0' + c);
    if (c.length === 13 && c[0] === '0') add(c.slice(1));
    // GTIN-14 / ITF-14 carrying a leading pack-level 0.
    if (c.length === 14 && c[0] === '0') add(c.slice(1));
    // UPC-E (8) → its expanded UPC-A (12) and the matching EAN-13 (13).
    if (c.length === 8) {
      const upcA = expandUpcE(c);
      if (upcA) {
        add(upcA);
        add('0' + upcA);
      }
    }
  }
  return out;
}

/** Best-effort symbology guess from a raw value (for label rendering). */
export function guessType(value: string): BarcodeType {
  const v = (value ?? '').trim();
  if (/^[0-9]{13}$/.test(v)) return 'ean13';
  if (/^[0-9]{12}$/.test(v)) return 'upc';
  return 'code128';
}
