# PLAN (draft — awaiting approval): receipt scanning

> Status: **proposed, not approved, no code written.** Nothing below has
> touched source. Reply "approved" (or pick alternatives) to start the build.

## 1. Goal

A shopper photographs a paper receipt after a trip; Tally extracts line
items (name, price each) and shows a trip summary vs the basket prediction.
Per AGENTS.md: **receipt images are discarded after line-item extraction** —
that invariant is the spine of this plan.

Done means: `POST /receipts/read` returns validated line items for a test
receipt photo, nothing image-shaped persists anywhere (proven by test), the
web basket screen offers "scan receipt" with an honest failure path, and all
workspace gates stay green.

## 2. Non-goals (explicitly out)

- No receipt image storage (whole, cropped, or thumbnail) — ever.
- No auto-correcting the shared price DB from receipts (receipts inform the
  trip summary only; contributing prices stays on the tag/barcode path).
- No OCR preprocessing in the Worker (browser downscales; ~30 ms CPU budget).
- No new auth surface (anonymous device session already exists).

## 3. Design

**Shared (`packages/shared/src/receipt.ts`, new):** `ReceiptLine`
`{ name, priceMinor, quantity }` + `ReceiptRead` `{ lines, totalMinor }`
zod contracts + `validateReceiptRead`. Same untrusted-input discipline as
`vision.ts` (`tagReadSchema` precedent).

**API (`apps/api/src/`):**

- `POST /receipts/read` — same guards as `/prices/read-tag` (1.5 MB limit,
  anonymous-key rejection, per-device caps via the existing `Caps` seam —
  recommendation: shared budget with tag reads, no new limiter).
- Photo-cache reuse: SHA-256 lookup first (identical receipt re-uploads cost
  nothing). Cache entries flagged by kind so tag/receipt replays never mix.
- Vision prompt: line-item JSON (`{lines:[{name, priceMinor, quantity}],
  totalMinor}`). New `readReceipt` method on `VisionProvider` (alongside
  `readTag`) + `modelName()` reuse for audit.
- `receipt_reads` table (audit only: store, line count, total, confidence,
  model, image hash — no pixels). Migration via drizzle-kit, applied to Neon.
- Bytes go out of scope exactly like the tag path; a test asserts no image
  material survives (see §5).

**Web (`apps/web/src/`):**

- Basket screen: "Scan receipt" button → file/camera input → downscale
  (existing `blobToBase64` helper) → POST → trip summary view (lines +
  total vs predicted range, register disclaimer stays).
- Offline: receipt capture requires the model — offline shows the honest
  "reconnect" note (same pattern as tag capture).

## 4. Files touched (only these)

- NEW: `packages/shared/src/receipt.ts` (+ test), `apps/api/src/receipt.test.ts`
- EDIT: `packages/shared/src/index.ts` (export), `apps/api/src/schema.ts`,
  `apps/api/src/vision.ts` (interface + prompt), `apps/api/src/index.ts`
  (route), `apps/web/src/screens/Basket.tsx` (button + summary)
- Migration: `apps/api/drizzle/000N_receipt-reads.sql` (applied to Neon)

## 5. Verification (must all pass before merge)

- `pnpm -r typecheck`, `pnpm -r test` (new: contract tests, route tests with
  stub vision, live-Neon audit-row test with cleanup, photo-cache replay test)
- `vite build` (web), `wrangler deploy --dry-run` (api)
- Privacy proof test: response contains no image data; DB holds no image
  column (column audit like the step-7 check); `ai_results`-style hash only
- `impeccable detect` clean on the touched screen

## 6. Questions (reply "go with your picks" or override)

1. **Shared caps budget for receipts and tags?** Recommended: yes — one
   `Caps` pool, no new limiter. Alternative: separate, higher receipt budget.
2. **Trip summary stays local-only?** Recommended: yes — summary is private,
   local-first like baskets (never joins shared data). Alternative: none
   (this one is load-bearing for privacy; changing it needs lawyer input).
3. **Max receipt image size 1.5 MB like tags?** Recommended: yes — receipts
   are longer but the browser downscale already handles it. Alternative: 2 MB.
