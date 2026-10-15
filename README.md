# Tally

Supportive shopping assistant for Jamaican supermarkets. Phone camera → price → basket → spend vs budget. It informs, the user decides.

## Workspace

Monorepo (`pnpm`):

- `apps/web` — Vite + React PWA (camera capture, basket + budget, offline catalog cache)
- `apps/api` — Hono on Cloudflare Workers (price report/resolve, tag OCR, catalog, anonymous-device auth, scheduled cleanup)
- `apps/landing` — Astro static landing page
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

V1 built and tested (see PROGRESS.md, currently step 15): persistent Neon
price DB, offline catalog, anonymous-device auth, durable caps, photo cache.
Next: deploy per DEPLOY.md (needs logins), then receipt scanning per
PLAN-receipts.md (awaiting approval).
