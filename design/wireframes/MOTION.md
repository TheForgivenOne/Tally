# Wireframe motion spec (v4.3)

Every animation below obeys the project's existing rules: transform/opacity only,
interruptible, instant under `prefers-reduced-motion`. No motion ships without its
fallback. Durations are ceilings, not targets.

## Screen 1 · Map home
- Pins drop once on load (translateY 8px → 0, opacity, 200ms, staggered 40ms).
  Reduced: appear instantly.
- Nearby card docks on first paint; no entrance on return visits (state, not event).
- Resume chip: no motion. It is persistent state.

## Screen 2 · Full-screen camera
- Sweep line loops the corner frame (translateY, 1600ms, linear, infinite).
  Pauses while `reading…` (state change must read as state change).
- Total chip updates: crossfade numbers only (opacity 120ms), never layout shift —
  tabular numerals keep width stable.
- Shutter: 68px target, scale 0.94 on press (transform 80ms), release fires capture.
  Reduced: no scale, instant fire.
- Found state: corner frame turns amber (color transition 150ms — color, not motion,
  allowed under reduced-motion).

## Screen 3 · Docked result card
- Card docks via translateY (240ms, ease-out, interruptible — grab or ✕ mid-flight
  settles it instantly).
- reading → resolved: spinner swaps to content with 120ms crossfade; no layout jump
  (fixed card height across all three states).
- Failed: no shake animation (vestibular risk on a held phone at arm's length).
  Static alert copy + recovery action first.

## Screen 4 · Total
- Count-up on add: 300ms, ease-out, `requestAnimationFrame`, cancels on next add
  (latest total wins, never queues).
- Composition bar segments resize with width transition 240ms; text equivalents
  update instantly (screen readers get the number, not the animation).
- Reduced: totals swap instantly, `aria-live` still announces.

## Screen 5 · Basket ledger
- Row add/remove: opacity + translateY 4px, 160ms. Undo toast slides up 160ms,
  auto-dismiss 5s, swipe-to-dismiss (tap ✕ alternative included).
- Stepper taps: no animation on the number (live region announces); button press
  state only.

## Screen 6 · Receipt closeout
- No entrance motion. A receipt is a document — it is simply there.
- Start-new-trip: standard primary press state.

## Global rules
- Nothing loops except the viewfinder sweep (and it stops under reduced-motion).
- No `transition: all` anywhere; every animated property named.
- Every timed UI (toast 5s, sweep, count-up) has an instant reduced-motion path.
- Test on-device at arm's length in sunlight: motion must aid aiming, never decorate.
