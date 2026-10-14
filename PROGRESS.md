# Tally — PROGRESS

## Done
- V1 step 1: `packages/shared` price foundation — `PriceSource` enum, `PriceObservation` (integer minor units), rank-based `resolvePrice`, `canOverwrite`, age-aware `errorBand`, `priceRange` with register disclaimer. 15 vitest tests (incl. `labelFor`), strict `tsc` clean (incl. `noUncheckedIndexedAccess`)
- V1 step 2: `apps/api` Hono skeleton — `/health`, `POST /prices/report` (zod-validated, 400 on user/device/coords keys), `GET /prices/resolve` (shared `resolvePrice` + exact/estimated label, consensus stub), `PriceStore` interface + in-memory impl. 11 vitest tests via `app.request()`, strict `tsc` clean, `wrangler types` parses config
- V1 step 3: `apps/web` PWA shell — state-machine nav (6 screens), live-camera shopping screen with pinned total + budget bar, basket reducer + undo + localStorage, amber≥80%/red≥100% warnings, SVG mascot, light high-contrast theme. 11 vitest tests, `tsc` clean, `vite build` with SW precache, impeccable `detect` clean
- V1 step 4: offline — versioned `StoreCatalog` contract + zod validation in shared; Dexie DB (`catalog` + `outbox` FIFO) behind store interfaces (memory impl in tests — no fake DB); sync engine (FIFO flush to `POST /prices/report`, offline cached-prices note); seed script generating R2 catalog JSON from fixture (Neon query lands with Drizzle slice), R2 upload documented as manual. 19 shared + 17 web tests, `tsc` clean, seed dry-run wrote 2 entries, `vite build` green, impeccable `detect` clean
- V1 step 5: tag OCR path — `TagRead` contract in shared; `VisionProvider` + OpenAI-compatible impl (Gemini + any OpenAI backend) in api; `POST /prices/read-tag` (1.5MB guard, 429 caps, generic 502s, images never stored, barcode-less reads return unstored); web capture live (canvas downscale → POST → item card, honest errors). 22 shared + 18 api + 17 web tests, `tsc` clean, `vite build` green, impeccable `detect` clean
- V1 step 6: barcode — `BarcodeScanner` seam (native-first, zxing ponyfill code-split) + pure `captureFlow` (decode→resolve→tag→failed); resolve returns name/brand; can't-read SVG diagram overlay after 2 failures; Shopping rewired. 22 shared + 18 api + 23 web tests, `tsc` clean, `vite build` green, impeccable `detect` clean
- Workspace: pnpm monorepo (`apps/web`, `apps/api`, `apps/landing`, `packages/shared`), `.gitignore`, README (2026-10-14)
- Pi config: `AGENTS.md` context, `.pi/settings.json`, `.pi/prompts/` (12 commands), `.pi/mcp.json` (neon/context7/exa)
- Skills: 25/25 `agent-skills` + hono, workers-best-practices, wrangler, web-perf, vercel-react-best-practices, vercel-composition-patterns, web-design-guidelines, frontend-ui-engineering, supabase-postgres-best-practices, impeccable (34 total)
- Review agents: `.pi/agents/` ×4 (inherit project context)
- Extensions: `pi-subagents`, `pi-plan-task` (project packages)
- Neon Postgres live (PG 18.6, PostGIS 3.6.4); creds in ignored `.env` + `apps/api/.dev.vars`; `psql` 16 installed, connection verified
- Retailer lead (via Exa): CAC price surveys, PriceSmart online prices, PriceRunJA competition — in AGENTS.md

## Next
- V1 kickoff: `/spec` or `/pt` for `packages/shared` price types + confidence logic (step 1 of `/plan-v1`)
- `/mcp login neon` (interactive session — OAuth)
- First push = security gate: audit secrets, push private first (per contract §7)
- Manual Cloudflare steps (need login, never headless): `wrangler secret put OPENAI_API_KEY`, `wrangler r2 object put tally-catalog/<store>.json --file=...`

## Known issues
- Neon free tier cold-starts after 5 min idle (slow first query)
- `.pi/mcp.json` ignored until project trusted in interactive session; headless runs need `pi --approve`
- `browser-testing-with-devtools` skill dormant until Chrome DevTools MCP configured
- pnpm vs esbuild: `@hono/cli@next` pulls an esbuild 0.28 peer whose postinstall fails under pnpm (binary mismatch); pinned stable `@hono/cli` instead, then removed it (stable lacks `routes`/`request`). If a future dep hits the same wall, suspect pnpm auto-install-peers + esbuild postinstall
