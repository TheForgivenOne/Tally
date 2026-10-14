# Wireframes changelog

`index.html` is the layout; the `.md` files are build contracts. Versions mark
spec changes, not releases — the app has not implemented past v1 screens yet
(see GAP.md for conformance).

- **v3** (`dabdac3`) — Rescued from `/tmp` into `design/wireframes/`. Six frames:
  map home, full-screen camera, docked result, fare-meter total, ledger, receipt.
- **v4** (`d1d8e79`) — Spacing unified on 4/8/12/16/20px; boundary language stated
  (rules separate regions, 14px top-round = docked-over-live, 8px = card);
  sources footer with 14 cited patterns.
- **v4.1** (`dfc2caf`) — A11y contract row on all six screens (focus order, live
  regions, non-modal discipline, stepper labels, receipt semantics).
- **v4.2** (`a50f26c`) — Vercel Web Interface Guidelines review (fetched 14 Oct
  2026): safe-area padding, empty states, truncation, Intl currency, overscroll
  containment, touch-action. Quotes/ellipses verified clean.
- **v4.3** (`f3260f4`) — MOTION.md: signature interactions + reduced-motion
  fallbacks; no-shake rule, no receipt entrance.
- **v4.4** (`c4e8330`) — SUNLIGHT.md: per-screen contrast plan for midday glare;
  opaque reading surfaces, double-stroke reticle, pattern + label (never hue alone).
- **v4.5** (`e0cc0ac`) — OFFLINE.md: degraded variants per screen; stale markers,
  hatched stale-cache segment, outbox depth visible, nothing captured ever lost.
- **v4.6** (`dd194a4`) — ONBOARDING.md: permission priming at moment of need,
  once-only self-deleting coach marks, ≤5-taps-to-first-read bar.
- **v4.7** (`5eb923a`) — ERRORS.md: 17 failure states with copy + action + role;
  copy-ban list for review.
- **v4.7.1** (`97da2ea`, `54b37c7`) — GAP.md reconciled with all specs; ERRORS.md
  established as copy canonical (failed-read unified, app delta logged).

## Pre-history (decisions that shaped v3, from session notes)
- Bottom sheet killed: NN/g transient-interruption guidance; result docks non-modal.
- Total rebuilt: remaining-as-hero (banking), composition bar, why-rows (fare UX).
- Home went map-centered: store-pick list dissolved into nearby card.
- Camera went full-bleed: no boxed viewfinder.
