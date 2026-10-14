import { z } from 'zod';

/**
 * What a vision model must return for a shelf tag. Validated on the way in —
 * model output is untrusted input and never trusted by shape alone.
 */
const tagReadSchema = z
  .object({
    priceMinor: z.number().int().positive(),
    name: z.string().min(1).optional(),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export type TagRead = z.infer<typeof tagReadSchema>;

export type TagReadValidation = { ok: true; read: TagRead } | { ok: false; error: string };

export function validateTagRead(payload: unknown): TagReadValidation {
  const parsed = tagReadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }
  return { ok: true, read: parsed.data };
}
