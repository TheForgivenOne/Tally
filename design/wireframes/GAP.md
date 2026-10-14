# Wireframes v4.7 → app conformance gap

Source of truth for layout: `index.html` (6 frames, served live).
Specs: MOTION.md · SUNLIGHT.md · OFFLINE.md · ONBOARDING.md · ERRORS.md.
App reality: `apps/web/src` (state-machine nav, token system in `styles.css`).

Status key: MISSING (not in app) · DIVERGED (in app, different shape) · CLOSE
(small edits) · SPECCED (wireframe-only contract, applies at build).

## Screen 1 · Map-centered home — MISSING
- App has: poster Home (`screens/Start.tsx`: mascot, lede, Start) → StorePick list → Budget.
- Wireframe wants: full-screen map, search row, resume chip, docked nearby card.
- Build cost: Leaflet + OSM tiles (no key, free); `ngo` geolocate-once (never stored);
  resume chip reads persisted trip from localStorage (already persisted).
- Note: tiles need connectivity at trip start — acceptable (offline matters in-aisle,
  catalog cached by then). Keep list fallback when geolocation denied.
- OFFLINE.md: degrades to cached tiles → wash ground + full list; distances hidden
  offline. ONBOARDING.md: location primed at first center, list fallback permanent.
  SUNLIGHT.md: opaque surfaces only, pins = white disc + ink glyph + shadow.

## Screen 2 · Full-screen camera — DIVERGED
- App has: live `<video>` + total card + Capture + Basket secondary (`screens/Shopping.tsx`).
- Wireframe wants: edge-to-edge feed, floating total chip top, 68px round shutter
  bottom-center, corner frame + sweep in-feed, hint line.
- Gap is CSS/layout only: no new plumbing. Shutter keeps current `submitPhoto` path.
- MOTION.md: sweep loop (pauses while reading), chip crossfade, shutter press scale,
  amber found-state. SUNLIGHT.md: 95%-opaque chip, hint scrim bar, double-stroke
  frame, states differ by fill + label. OFFLINE.md: stale clock marker on chip.
  ERRORS.md: states 1–2, 6, 10, 16.

## Screen 3 · Docked result card — DIVERGED
- App has: result rendering TBD post-capture (captureNote strings; CannotReadOverlay
  after 2 fails exists).
- Wireframe wants: non-modal bottom-docked card, grabber + ✕, reading → resolved →
  failed states, feed keeps running behind.
- Gap: add card component + three states; keep CannotReadOverlay as the
  failed-twice escalation.
- MOTION.md: dock translateY 240ms interruptible, fixed card height (no layout jump),
  no shake on failure. OFFLINE.md: “cached” pill with age; offline miss queues to
  outbox with visible depth. ERRORS.md: states 3–5, 7–9.
- Copy audit 14 Oct: wireframe failed-state now matches deck #3 verbatim; app
  `Shopping.tsx` captureNote strings predate the deck — align to ERRORS.md states
  2/3/6 at build.

## Screen 4 · Total: remaining-hero + composition — MISSING
- App has: `BudgetBar` (range + % bar, amber ≥80% / red ≥100%).
- Wireframe wants: REMAINING as hero number, exact-vs-estimated composition bar
  (tap segments, not long-press-only), why-rows per line (source + band),
  count-up on add (300ms, instant under reduced-motion).
- Gap: `basket.tsx` already carries `{source, age, confidence}` per line —
  composition is derived data, no schema change.
- MOTION.md: 300ms cancellable count-up, segment resize 240ms. SUNLIGHT.md: 28px
  hero, pattern + label segments, ≥11px band text at 4.5:1. OFFLINE.md: hatched
  stale-cache segment, widened bands, pending-count line. ERRORS.md: states 14–15.

## Screen 5 · Basket ledger — CLOSE
- App has: ledger rows, steppers, Undo (`screens/Basket.tsx`, `basket.tsx`).
- Wireframe wants: unit-price-on-row only, totals confined to pinned `.bar`,
  minus-stops-at-1 + separate Remove, polite announcements.
- Gap: verify each rule; likely small edits + `role=status` wiring.
- MOTION.md: row add/remove 160ms, 5s swipeable Undo toast. SUNLIGHT.md: semibold
  ink prices (never muted), pill border + text, opaque sticky bar. OFFLINE.md: outbox
  badge + clock dots on queued lines. ONBOARDING.md: empty basket gets “Point at a
  tag to begin”. ERRORS.md: state 13.

## Screen 6 · Receipt closeout — CLOSE
- App has: `EndTrip` summary.
- Wireframe wants: paper-receipt grammar (monospace rows, ✓/~ paired with
  exact/estimated text), single Start-new-trip primary, register-compare line.
- Gap: restyle + copy; list semantics for screen readers.
- OFFLINE.md: outbox-pending line (“totals may tighten”). SUNLIGHT.md: untinted
  paper, symbols at text size minimum. MOTION.md: no entrance motion (a document
  is simply there).

## A11y contract (all screens) — PARTIAL
- App has: token touch targets ≥44px, focus rings, some `role=status/alert`.
- Wireframe adds: shutter first focus stop, total chip live region (throttled),
  non-modal result (no focus trap), stepper aria-labels, receipt list semantics.
- Gap: audit pass per screen on build.
- ERRORS.md is the message source: 17 states, copy bans enforced in review.
  ONBOARDING.md fixes tap-to-first-read ≤ 5 as the acceptance bar.
