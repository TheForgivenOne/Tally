# Wireframe error copy deck (v4.7)

Every failure string in the app, in one place. Rule (WIG): each message states the
problem AND the fix in second person, active voice. No “something went wrong”
anywhere. Each entry: trigger → copy → action → role.

## Capture & reading
1. Camera not ready (shutter tapped before stream starts)
   → “Camera is warming up — one second.” → auto-enables; no button. `role=status`.
2. Frame grab failed
   → “Could not grab that frame — hold steady and try again.” → [Try again]. `role=alert`.
3. Tag unreadable, first fail
   → “Couldn't read it — tilt for glare, then retake.” → [Retake] [Basket]. `role=alert`.
4. Tag unreadable, second fail
   → CannotReadOverlay diagram (barcode/QR guide) — already implemented. Recovery,
   not error: “Line the code up inside the frame.”
5. Barcode decoded, no price anywhere
   → “New to Tally — add it with the shelf price.” → manual price entry seeds the
   shared observation (attribution: user-confirmed). Honest cold-start handling.

## Network & limits
6. Offline at capture
   → “You are offline — reconnect to read prices. Cached prices still work.”
   → capture queues to outbox; no button needed. `role=status`.
7. Daily AI cap reached (429)
   → “Today's smart reads are used up — cached and tag prices still work.”
   → [Got it]. Never a dead screen; caps are per-device, explained once.
8. Photo too large (413)
   → never user-facing: client downscales to 1024px before send (already
   implemented). Listed here so nobody reintroduces the error.
9. Server read failure (502)
   → “Couldn't read that photo — try again.” → [Try again]. Generic by design
   (provider details never leak to UI).

## Store & trip
10. No store picked at capture
    → “Pick a store first — prices are per store.” → [Pick store]. `role=status`.
11. Nothing within 2 km (map empty)
    → “No stores nearby — try a parish search.” → search field focused. List
    fallback always present.
12. No store in cached list (offline search miss)
    → “No match on this phone — reconnect to search all stores.” → [See cached
    stores]. Honest about the boundary.

## Basket & budget
13. Remove tapped
    → no confirm modal: item removes, Undo toast appears for 5s (`role=status`).
    Zavvy rule — nothing silently dropped, nothing modally blocked.
14. Budget passed (100%)
    → “Over budget by J$X — the register may still differ.” Bar red, copy states
    the gap number, not just the color.
15. Stale total (offline, aged cache)
    → chip wears “updated 12 min ago” clock marker — a qualifier, not an error.
    No alert role; polite live region only.

## Permissions
16. Camera denied
    → “No camera — you can still add prices by photo upload or typing the shelf
    price.” → [Upload photo] [Type price]. Permanent fallback, asked once.
17. Location denied
    → map centers on last store / search; “Enter store name instead.” No banner,
    no re-ask except in context.

## Copy bans (enforced in review)
- “Something went wrong”, “Error”, “Oops”, exclamation marks in errors.
- Error codes or provider names in user copy (429/502 stay in logs).
- Blame: “You didn't…”, “Invalid…”. Say what happened and what fixes it.
- First person (“We're having trouble”). Second person or imperative only.

## Verification
- Trigger each of the 17 states in test/dev and screenshot; attach to the
  release checklist in PROGRESS.md.
