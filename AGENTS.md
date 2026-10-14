# Tally — Project Context

> Supportive shopping assistant for Jamaican supermarkets. Phone camera → price → basket → spend vs budget. It informs, the user decides. (Formerly "Tallyman".)

## Owner & status

- Owner: Dondre · Status: planning done, no code written yet (14 Oct 2026)

## Locked decisions (do not revisit without Dondre)

- Supportive assistant, never a decision-maker.
- Core loop: camera → price check → add to basket → running spend always visible.
- Automate maximally. If users must type, a calculator is better.
- Show a **predicted total**, never promise it's exact. Basket shows a range + "register total may differ".
- AI is the **last resort** for prices. OCR + AI cover the cold start only.
- Unreadable tag → show barcode/QR diagram overlay, guide camera there.
- Offline support via cached data. Location used once to pick store (save store ID, not coords).
- Collect usage data (prices, product data), never personal data. Data is the edge.
- Web app first (PWA), mobile later. No Next.js.
- Stack: Vite + React PWA (Cloudflare static) · Hono on Workers · Neon Postgres + Drizzle + PostGIS · Better Auth (anonymous device first) · Dexie/IndexedDB offline queue · barcode-detector polyfill · R2 per-store catalog JSON + Workers Cache API (no Redis) · Cron Triggers · Astro landing page.
- Fast photo cache to avoid repeat AI calls.

## Price resolution order (stop at first hit)

1. Device/server cache — confirmed recent price for that store + product
2. Shelf-tag OCR via Gemini vision
3. Guided barcode scan → identifies product → re-check cache (barcode alone ≠ price)
4. Web reference price (retailer-published only) — label "reference"
5. AI estimate — label "estimated"

Every price stores source, age, confidence. Lower sources never overwrite higher ones.
Error bands (tune with receipts): recent tag ±0–2% · older cache ±5–10% · web ±10% · AI ±25%.

## Data & privacy (Jamaica Data Protection Act — lawyer review before launch)

- Shared (anonymous): product (barcode, name, brand, size), price, source, confidence, promo flag, store, date. No user/device ID, no location trail. Consensus (2+ matching reports), not reputation.
- Private (separate schema, local-first): trips, basket history, budgets. Never joins shared data.
- Receipt images discarded after line-item extraction. Shelf photos never stored whole — only cropped tag images linked to confirmed prices (training data for in-house reader).
- Plain-language consent line + opt-out for contributing + terms clause for using contributed prices.

## Schema sketch

`stores` (PostGIS point, tag template) · `products` · `price_observations` (append-only) · `current_prices` (derived) · `ai_results` · `tag_crops` · Private: `users|devices`, `trips`, `basket_items`.

## AI rules

Server-side only, behind provider interface, only after cache/barcode/tag fail, results stored with confidence, capped per day + per device. Goal: AI use shrinks as data grows.

## Build order

- V1: basket + budget, barcode + photo capture, Gemini tag read, source/confidence tracking, shared DB, offline catalog.
- Then: receipt scanning → price history + trip summaries → pre-trip lists + cross-store comparison (info only).
- Later: Expo app (reuse shared pkg) or Capacitor wrap, name matching, in-house tag reader, data products.

## Constraints (checked Oct 2026 — re-confirm)

- Workers free: ~100k req/day, ~30ms CPU/req → resize photos in browser, never in Worker.
- R2 free: 10 GB, 1M writes, 10M reads/mo.
- Neon free: 0.5 GB, 100 CU-hours, scale-to-zero after 5 min (slow first query), PostGIS ok. Plan roll-up of old observations before 0.5 GB fills.

## Open risks

- Walk target stores: tag contents (barcode/QR/neither)? Any QR→price?
- Domain/GitHub/trademark check for "Tally" (crowded name).
- Confirm retailers publishing prices online + terms before pulling.
- Confirm Gemini quota/cost + current GCT exemption rules per category.
- Cold start: seed 150–200 items at 1–2 Montego Bay stores before real users.
- OCR struggles: glare, curved tags, handwritten stickers → retake flow + tap-to-pick.
- Adoption risk: depth in one town first.

## Monorepo layout

- `apps/web` — Vite + React PWA · `apps/api` — Hono on Workers · `apps/landing` — Astro
- `packages/shared` — types, validation, resolution + confidence logic (reused by web, api, future Expo app)

## Working agreements for Pi

- Small, reviewable diffs. Monorepo-aware edits (shared logic lives in `packages/shared`, never duplicated).
- Privacy invariants are hard rules: no user/device IDs in shared schema, no whole shelf photos stored, receipts discarded after extraction.
- Every price path must carry `{ source, age, confidence }` and an exact/estimated label.
- Confirm free-tier-sensitive choices (Worker CPU, R2, Neon) before implementing.
