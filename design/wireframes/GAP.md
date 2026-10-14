# Wireframes v4 → app conformance gap

Source of truth for layout: `index.html` (6 frames, served live).
App reality: `apps/web/src` (state-machine nav, token system in `styles.css`).

## Screen 1 · Map-centered home — MISSING
- App has: poster Home (`screens/Start.tsx`: mascot, lede, Start) → StorePick list → Budget.
- Wireframe wants: full-screen map, search row, resume chip, docked nearby card.
- Build cost: Leaflet + OSM tiles (no key, free); `ngo` geolocate-once (never stored);
  resume chip reads persisted trip from localStorage (already persisted).
- Note: tiles need connectivity at trip start — acceptable (offline matters in-aisle,
  catalog cached by then). Keep list fallback when geolocation denied.

## Screen 2 · Full-screen camera — DIVERGED
- App has: live `<video>` + total card + Capture + Basket secondary (`screens/Shopping.tsx`).
- Wireframe wants: edge-to-edge feed, floating total chip top, 68px round shutter
  bottom-center, corner frame + sweep in-feed, hint line.
- Gap is CSS/layout only: no new plumbing. Shutter keeps current `submitPhoto` path.

## Screen 3 · Docked result card — DIVERGED
- App has: result rendering TBD post-capture (captureNote strings; CannotReadOverlay
  after 2 fails exists).
- Wireframe wants: non-modal bottom-docked card, grabber + ✕, reading → resolved →
  failed states, feed keeps running behind.
- Gap: add card component + three states; keep CannotReadOverlay as the
  failed-twice escalation.

## Screen 4 · Total: remaining-hero + composition — MISSING
- App has: `BudgetBar` (range + % bar, amber ≥80% / red ≥100%).
- Wireframe wants: REMAINING as hero number, exact-vs-estimated composition bar
  (tap segments, not long-press-only), why-rows per line (source + band),
  count-up on add (300ms, instant under reduced-motion).
- Gap: `basket.tsx` already carries `{source, age, confidence}` per line —
  composition is derived data, no schema change.

## Screen 5 · Basket ledger — CLOSE
- App has: ledger rows, steppers, Undo (`screens/Basket.tsx`, `basket.tsx`).
- Wireframe wants: unit-price-on-row only, totals confined to pinned `.bar`,
  minus-stops-at-1 + separate Remove, polite announcements.
- Gap: verify each rule; likely small edits + `role=status` wiring.

## Screen 6 · Receipt closeout — CLOSE
- App has: `EndTrip` summary.
- Wireframe wants: paper-receipt grammar (monospace rows, ✓/~ paired with
  exact/estimated text), single Start-new-trip primary, register-compare line.
- Gap: restyle + copy; list semantics for screen readers.

## A11y contract (all screens) — PARTIAL
- App has: token touch targets ≥44px, focus rings, some `role=status/alert`.
- Wireframe adds: shutter first focus stop, total chip live region (throttled),
  non-modal result (no focus trap), stepper aria-labels, receipt list semantics.
- Gap: audit pass per screen on build.
