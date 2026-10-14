# Design

<!-- impeccable:design-schema 1 -->

## World

Market-ledger: a trustworthy market tool, not a tech demo. Paper-white wash ground (`--wash`), white surface cards with hairline `--line` borders, Tally green (`--brand #1a7f37`) reserved for primary actions and budget health, amber/red tints only as warning fills. Tabular numerals on every price. 8px radius, pill labels. System type stack. Icons as authored SVG strokes (mascot tally-mark badge). No gradients, no hero scaffolds, no kickers, no emoji iconography.

## Tokens

`apps/web/src/styles.css` `:root` owns all values: brand/ink/muted/surface/wash/line, amber + red bg/ink/bar triples, on-dark, viewfinder; radius + pill; spacing scale (`--space-1`–`--space-12`); type scale (`--text-small`–`--text-total`); `--touch: 2.75rem` minimum touch target; `--measure: 32rem` content width. No hex and no spacing/border values outside token definitions.

## Screens (Operate, mobile-first 360px)

- Home: centered mascot, name, one-line lede, single primary action.
- Store pick / budget: one question per screen, real copy, labeled inputs.
- Shopping: live viewfinder (dark surface) with mascot badge, sticky predicted-total ledger card with budget bar, thumb-wide Capture primary, basket secondary.
- Basket: ledger list with exact/estimated pill labels, qty steppers, undo (disabled when empty), end-trip primary.
- Overlays: guided barcode diagram dialog; offline cached-prices note; named camera errors with recovery copy.

## States & accessibility

Every screen carries loading/empty/error Honest states; `role=status|alert|dialog|progressbar` where each fits; one `h1` per screen; visible focus rings; `::selection` themed; touch targets ≥44px; contrast ≥4.5:1 throughout (sunlight brief).

## Motion

None shipped. No transitions or entrances; state changes are instant. Revisit only with a named signature interaction and a `prefers-reduced-motion` alternative.
