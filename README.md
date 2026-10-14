# Tally

Supportive shopping assistant for Jamaican supermarkets. Phone camera → price → basket → spend vs budget. It informs, the user decides.

## Workspace

Monorepo (`pnpm`):

- `apps/web` — Vite + React PWA (planned)
- `apps/api` — Hono on Cloudflare Workers (planned)
- `apps/landing` — Astro landing page (planned)
- `packages/shared` — types, validation, resolution + confidence logic

## Pi setup

- Project context: `AGENTS.md` (source of truth from the 14 Oct 2026 handoff)
- Project settings: `.pi/settings.json`
- Slash commands: `.pi/prompts/`
  - `/plan-v1` — V1 build sequence
  - `/price-check` — price-resolution review
  - `/privacy-check` — privacy-invariant review

After editing Pi config, run `/reload` in interactive Pi.

## Status

Planning done, no app code written yet. Next: run `/plan-v1` step 1 (`packages/shared` price types + confidence logic).
