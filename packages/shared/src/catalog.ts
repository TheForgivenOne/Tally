import { z } from 'zod';

/** Version of the per-store catalog JSON contract (R2 object shape). */
export const CATALOG_VERSION = 1 as const;

const catalogEntrySchema = z
  .object({
    barcode: z.string().min(1),
    name: z.string().min(1),
    brand: z.string().optional(),
    size: z.string().optional(),
    priceMinor: z.number().int().positive(),
    source: z.enum(['cache', 'tag', 'barcode-cache', 'web', 'ai']),
    observedAt: z.string().datetime(),
    confidence: z.number().min(0).max(1),
    promo: z.boolean().optional(),
  })
  .strict();

const catalogSchema = z
  .object({
    version: z.literal(CATALOG_VERSION),
    storeId: z.string().min(1),
    generatedAt: z.string().datetime(),
    entries: z.array(catalogEntrySchema),
  })
  .strict();

export type CatalogEntry = z.infer<typeof catalogEntrySchema>;
export type StoreCatalog = z.infer<typeof catalogSchema>;

export type CatalogValidation = { ok: true; catalog: StoreCatalog } | { ok: false; error: string };

/** Validate an unknown payload (R2 fetch, seed output) against the contract. */
export function validateCatalog(payload: unknown): CatalogValidation {
  const parsed = catalogSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  return { ok: true, catalog: parsed.data };
}
