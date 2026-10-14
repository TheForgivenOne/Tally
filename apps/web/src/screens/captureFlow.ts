import type { PriceSource } from '@tally/shared';

export interface ResolvedItem {
  barcode: string;
  name: string;
  priceMinor: number;
  source: PriceSource;
  observedAt: string;
  confidence: number;
}

export interface TagItem extends ResolvedItem {
  stored: boolean;
}

export interface CaptureDeps {
  decodeBarcode: () => Promise<string | null>;
  resolvePrice: (barcode: string) => Promise<ResolvedItem | null>;
  readTag: (imageBase64: string, barcode?: string) => Promise<TagItem | null>;
}

export type CaptureOutcome =
  | { kind: 'resolved'; item: ResolvedItem }
  | { kind: 'tag'; item: TagItem }
  | { kind: 'failed' };

/**
 * Degradation chain: barcode → cache, else photo → OCR, else failure.
 * A decoded barcode always rides along to the tag read so it can store.
 */
export async function captureFlow(imageBase64: string, deps: CaptureDeps): Promise<CaptureOutcome> {
  const barcode = await deps.decodeBarcode().catch(() => null);
  if (barcode) {
    const resolved = await deps.resolvePrice(barcode).catch(() => null);
    if (resolved) return { kind: 'resolved', item: resolved };
  }
  const tag = await deps.readTag(imageBase64, barcode ?? undefined).catch(() => null);
  if (tag) return { kind: 'tag', item: tag };
  return { kind: 'failed' };
}
