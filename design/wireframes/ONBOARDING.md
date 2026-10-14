# Wireframe onboarding spec (v4.6)

Context: the first 60 seconds decide retention. Tally needs two OS permissions
(camera, location) and one mental model (predicted total, not exact). Rule: prime
before the OS asks, one idea per screen, skippable everything, never a login wall.

## Before anything: the promise (Home, first launch)
- State A (fresh) carries the whole pitch in one line: “Point at a price. Know
  your total.” No carousel, no 3-page tour — the product teaches itself by use.
- Reassurance line under Start (already wireframed): “Works offline · No account ·
  Prices stay anonymous.” Kills the three biggest install fears in nine words.

## Permission priming (the critical sequence)
- Camera: primed on the Home → Shopping transition, NOT at launch. Inline card:
  “Tally reads shelf tags through your camera. Photos never leave your phone
  unread.” [Continue] fires the OS dialog; [Not now] enters Shopping with the
  native `<input capture>` fallback path (already implemented).
- Location: primed when the map first centers. “To show stores near you. Your
  location is used once and never stored.” [Continue] / [Enter store name instead]
  (list fallback — denial must cost nothing).
- Denied either: no dead-ends, no nag banners. Fallbacks are permanent citizens:
  capture-via-upload for camera, list search for location. Re-ask only in context
  (tapping the shutter with no camera re-primes once).

## First capture coach marks (Shopping, first trip only)
- Single hint line in-feed: “Point at the shelf tag” — then it disappears after
  the first successful read and never returns.
- First resolved result gets one extra line in the card: “That's it — J$1,250
  added. Keep going.” Second capture onward: standard card.
- First failed read: the CannotReadOverlay diagram (already implemented) IS the
  onboarding — no separate tutorial needed.

## First total explanation (Total, first trip only)
- First time the composition bar renders, one dismissible line beneath it:
  “Green is tag reads, amber is estimates. The register may differ.”
  Persist dismissal in localStorage; never show again.
- The “register total may differ” disclaimer is permanent (trust rule), but the
  tutorial line is once-only.

## Budget setup (no onboarding needed)
- The budget screen asks one question with preset chips (5/10/15/20k) — already
  wireframed. No explainer: the Total screen teaches budgets by showing one.
- Skipping budget entirely must be possible (“Skip for now”) — the app works
  with spend-tracking only, budget adds the remaining-hero.

## Copy constraints (from WIG review)
- Priming cards use second person, active voice, specific button labels:
  “Allow camera” not “Continue”; “Show nearby stores” not “OK”.
- Every priming card states the privacy term in the same breath as the ask —
  the ask and the guarantee are one unit, never separated.

## What we explicitly do NOT build
- No multi-page onboarding carousel. No login/account wall. No tooltips tour.
- No progress checklist (“3 of 5 steps!”) — a shopping tool, not a course.
- No re-engagement prompts for dismissed coach marks.

## Verification
- Fresh-install walk-through (clear site data) per release: count taps to first
  successful read; target ≤ 5 from launch. Record in PROGRESS.md.
