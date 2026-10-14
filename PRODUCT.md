# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Jamaican supermarket shoppers on phones, mid-trip, often one-handed, often in bright aisles. They want to know their running total against a budget — not advice, not decisions.

## Product Purpose

Tally turns a phone camera into a running basket: point at a shelf tag, get the price, track spend against a budget through the trip. Success is a trip where the shopper is never surprised at the register. It informs; the user decides. (Launch town undecided — seed data uses Montego Bay store IDs as placeholders only.)

## Positioning

Supportive assistant, never a decision-maker. Predicted totals with honest error bands and "register total may differ" — no app in this lane promises less, which is why shoppers can trust it. Anonymous contributed price data is the long-term edge. (Assumed: no direct competitor on-device in Jamaican stores today beyond the PriceRunJA web scraper.)

## Operating Context

- In-store, on foot, variable light (bright aisles, glare on tags), patchy connectivity (offline-first).
- Shelf tags vary: printed, curved, handwritten sale stickers.
- Prices are per store; the app remembers the store, never the user's location trail.

## Capabilities and Constraints

- Core loop: camera → price check → add to basket → running spend always visible.
- Price resolution order: device/server cache → shelf-tag OCR → guided barcode scan → retailer-published web reference → AI estimate (last resort). Every price carries source, age, confidence.
- Offline via cached catalog + outbox queue. No Next.js. Vite PWA + Hono on Workers + Neon Postgres.
- Privacy: shared price data is anonymous (no user/device IDs, no location trail); trips and budgets are private and local-first; receipt images discarded; shelf photos never stored whole.
- Free-tier budgets bind everything: ~30ms Worker CPU (resize in browser), R2 free limits, Neon 0.5GB (roll up old observations).

## Brand Commitments

- Name: Tally. Mascot on the camera screen (tally-mark badge, green).
- Voice: plain, supportive, honest about uncertainty. Exact vs estimated labels everywhere.
- (Assumed: green `#1a7f37` primary is approved as brand color.)

## Evidence on Hand

- Working PWA shell + API on demo tunnels (see PROGRESS.md). No real user trips yet.
- Retailer leads: CAC Jamaica price surveys, PriceSmart Jamaica online prices.
- No testimonials, no benchmarks, no logo files — do not fabricate any.

## Product Principles

1. Automate maximally: if the user must type, a calculator is better.
2. Never promise exactness: ranges, labels, and the register disclaimer.
3. AI is the last resort and must shrink as contributed data grows.
4. Data is the edge; personal data is never the price of it.

## Accessibility & Inclusion

Phone-first, one-thumb operation; touch targets ≥44px; contrast must survive direct sunlight; errors name the problem and the recovery. (Assumed: WCAG 2.1 AA as the bar; no product-specific accessibility evidence yet.)
