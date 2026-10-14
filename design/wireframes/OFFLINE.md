# Wireframe offline spec (v4.5)

Context: in-aisle connectivity drops (concrete,Crowded Wi-Fi, dead zones) while the
trip must continue. Offline is a first-class state, not an error screen. Rule:
every screen stays usable offline; anything that can't work says exactly what
can't and what still can. Copy is honest, never "something went wrong".

## Screen 1 · Map home
- Tiles may fail: map degrades to last-cached tiles, then to a plain wash ground
  with the nearby list still fully usable (list is data, not imagery).
- No connectivity at trip start: search still works against the cached store list;
  distances hidden (“distance needs connection”), alphabetical order instead.
- Resume chip is local-first — always available offline.

## Screen 2 · Full-screen camera
- Capture always works offline (camera + shutter are device-local).
- After capture, the honest note replaces the guess: “You are offline — reconnect
  to read prices. Cached prices still work.” (copy already in the app).
- Total chip keeps showing the last computed range with a “stale” marker
  (clock icon + “updated 12 min ago”), never silently frozen.

## Screen 3 · Docked result card
- Offline + cache hit: resolved state gains a “cached” pill with the price age
  (“cached · 3 days ago”). Confidence comes from `shared/price.ts` bands, not vibes.
- Offline + cache miss: failed variant with one action — “Retry when online”
  queues the capture in the outbox (Dexie) instead of discarding it. Queue depth
  shown (“2 reads waiting”).

## Screen 4 · Total
- Range widens honestly offline: lines read from stale cache carry their age into
  the band math (older cache ±5–10% per PRODUCT.md). The why-rows show the age.
- Composition bar gains a third segment if needed: stale-cache portion in hatched
  neutral — never silently folded into “exact”.
- Outbox pending count appears under the hero (“+2 reads will refine this”).

## Screen 5 · Basket ledger
- Fully local, fully usable offline. No changes except: outbox badge on the
  pinned bar (“2 to sync”) and queued lines marked with a clock dot until
  their prices confirm.
- Undo stays local — never gated on connectivity.

## Screen 6 · Receipt closeout
- Closes fine offline. Adds one line when the outbox is non-empty: “2 prices
  will confirm when you're back online — totals may tighten.”
- Start-new-trip always available; outbox survives across trips (FIFO flush in
  `apps/web/src/offline/sync.ts`).

## Sync contract (already implemented, wireframes now require it)
- Outbox FIFO flush on reconnect; lower sources never overwrite higher ones;
  every price carries `{source, age, confidence}` — the UI just renders it.
- No destructive dead-ends: nothing the user captured is ever lost to acko
  dead zone; the worst case is a queued read and an honest label.

## Verification
- Airplane-mode walk-through of all six screens per release; record in
  PROGRESS.md alongside the sunlight pass.
