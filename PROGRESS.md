# Tally — PROGRESS

## Done
- V1 step 1: `packages/shared` price foundation — `PriceSource` enum, `PriceObservation` (integer minor units), rank-based `resolvePrice`, `canOverwrite`, age-aware `errorBand`, `priceRange` with register disclaimer. 15 vitest tests (incl. `labelFor`), strict `tsc` clean (incl. `noUncheckedIndexedAccess`)
- V1 step 2: `apps/api` Hono skeleton — `/health`, `POST /prices/report` (zod-validated, 400 on user/device/coords keys), `GET /prices/resolve` (shared `resolvePrice` + exact/estimated label, consensus stub), `PriceStore` interface + in-memory impl. 11 vitest tests via `app.request()`, strict `tsc` clean, `wrangler types` parses config
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

## Known issues
- Neon free tier cold-starts after 5 min idle (slow first query)
- `.pi/mcp.json` ignored until project trusted in interactive session; headless runs need `pi --approve`
- `browser-testing-with-devtools` skill dormant until Chrome DevTools MCP configured
