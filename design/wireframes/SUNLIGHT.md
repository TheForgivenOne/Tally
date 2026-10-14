# Wireframe sunlight spec (v4.4)

Context: midday Jamaican sun on a phone at arm's length, possibly with a cracked
screen protector. Everything below is specified per screen, not assumed from tokens.
Base rule (already in DESIGN.md): contrast ≥ 4.5:1 throughout. This file says how
each screen keeps it when the environment fights back.

## Screen 1 · Map home
- Map tiles wash out first. Pins never rely on tile contrast: solid white disc +
  ink glyph + drop shadow on every pin, ≥44px touch target doubling as the
  visible target.
- Search row and nearby card are opaque surfaces (no blur, no translucency over
  the map). Text sits on white, never on tiles.
- Resume chip: solid fill (`#e3f2e7`), ink text — readable even when the map
  behind it is pure glare.

## Screen 2 · Full-screen camera (worst case)
- The feed can be any brightness — sky, white shelf, sun flare. So every floating
  control carries its own reading surface (AirTake rule, already in footer):
  total chip is 95%-opaque white, shutter is a solid ring, hint text gets a
  translucent black scrim bar (rgba(0,0,0,.55)) full-width behind it.
- Corner frame: 3px solid brand green PLUS white outer keyline (double stroke) —
  visible against both dark aisles and blown-out windows.
- Sweep line: white core + green halo, same reason.
- Amber/red budget states must differ by more than hue (bar fill % + label text),
  for sun-faded screens and color vision alike.

## Screen 3 · Docked result card
- Opaque white, full-width, top-rounded — the card is a shade structure: content
  area is always a controlled surface regardless of feed brightness.
- State pills (reading/resolved/failed) pair icon + text, never color alone.
- Failed-state recovery button is the highest-contrast element on the card
  (solid brand fill, white text).

## Screen 4 · Total
- Hero remaining number: ink on white, tabular numerals, minimum 28px — the one
  number a squinting shopper must read.
- Composition bar: exact/estimated segments differ by pattern AND label
  (▓ vs ░ + text key below), not green-vs-amber alone. Green/amber fills hold
  ≥3:1 against white at bar weight; the text key carries the meaning regardless.
- Why-rows: source band text (e.g. “±25%”) is never smaller than 11px and never
  muted below 4.5:1 — small gray text dies first in sun.

## Screen 5 · Basket ledger
- Unit prices in semibold ink, never muted gray — price is primary content.
- Exact/estimated pills: pill border + text, tint fill is decorative backup only.
- Pinned total bar: top rule + solid surface; sticky content must not go
  translucent on scroll (no frosted-glass ledger).

## Screen 6 · Receipt closeout
- Paper grammar is a sunlight asset: monospace ink-on-white rows are the
  highest-contrast pattern in the app. Keep it that way — no tinted receipt paper.
- ✓/≈ symbols at text size minimum, always with their text partners.

## Verification (on-device, cannot be done from this box)
- Midday walk-through at each screen: read hero number, total chip, shutter
  affordance, and failed-state button without shading the phone.
- Low-brightness + battery-saver pass: same script at minimum backlight.
- Record results in PROGRESS.md before build sign-off.
