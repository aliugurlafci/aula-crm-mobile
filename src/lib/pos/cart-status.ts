/**
 * Badge tone for a cart's lifecycle state — shared by the cart list and the cart
 * editor so the same status never reads differently between the two screens.
 * Mirrors the tones the backend entity declares for the `status` field
 * (Backend/src/lib/metadata/entities/cart.ts).
 */
import type { BadgeTone } from '@/components/ui/Badge';

export function cartStatusTone(status: string): BadgeTone {
  switch (status) {
    case 'sent':
      return 'warning'; // waiting at the register — needs someone's attention
    case 'suspended':
      return 'neutral';
    case 'converted':
      return 'success';
    case 'cancelled':
      return 'danger';
    default:
      return 'info'; // open draft
  }
}
