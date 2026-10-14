# Tally — Project Context

> Supportive shopping assistant for Jamaican supermarkets. Phone camera → price → basket → spend vs budget. It informs, the user decides. (Formerly "Tallyman".)

## Owner & status

- Owner: Dondre · Status: planning done, no code written yet (14 Oct 2026)

## Locked decisions (do not revisit without Dondre)

- Supportive assistant, never a decision-maker.
- Core loop: camera → price check → add to basket → running spend always visible.
- Automate maximally. If users must type, a calculator is better.
- Show a **predicted total**, never promise it's exact. Basket shows a range + "register total may differ".
- AI is the **last resort** for prices. OCR + AI cover the cold start only.
- Unreadable tag → show barcode/QR diagram overlay, guide camera there.
- Offline support via cached data. Location used once to pick store (save store ID, not coords).
- Collect usage data (prices, product data), never personal data. Data is the edge.
- Web app first (PWA), mobile later. No Next.js.
- Stack: Vite + React PWA (Cloudflare static) · Hono on Workers · Neon Postgres + Drizzle + PostGIS · Better Auth (anonymous device first) · Dexie/IndexedDB offline queue · barcode-detector polyfill · R2 per-store catalog JSON + Workers Cache API (no Redis) · Cron Triggers · Astro landing page.
- Fast photo cache to avoid repeat AI calls.

## Price resolution order (stop at first hit)

1. Device/server cache — confirmed recent price for that store + product
2. Shelf-tag OCR via Gemini vision
3. Guided barcode scan → identifies product → re-check cache (barcode alone ≠ price)
4. Web reference price (retailer-published only) — label "reference"
5. AI estimate — label "estimated"

Every price stores source, age, confidence. Lower sources never overwrite higher ones.
Error bands (tune with receipts): recent tag ±0–2% · older cache ±5–10% · web ±10% · AI ±25%.

## Data & privacy (Jamaica Data Protection Act — lawyer review before launch)

- Shared (anonymous): product (barcode, name, brand, size), price, source, confidence, promo flag, store, date. No user/device ID, no location trail. Consensus (2+ matching reports), not reputation.
- Private (separate schema, local-first): trips, basket history, budgets. Never joins shared data.
- Receipt images discarded after line-item extraction. Shelf photos never stored whole — only cropped tag images linked to confirmed prices (training data for in-house reader).
- Plain-language consent line + opt-out for contributing + terms clause for using contributed prices.

## Schema sketch

`stores` (PostGIS point, tag template) · `products` · `price_observations` (append-only) · `current_prices` (derived) · `ai_results` · `tag_crops` · Private: `users|devices`, `trips`, `basket_items`.

## AI rules

Server-side only, behind provider interface, only after cache/barcode/tag fail, results stored with confidence, capped per day + per device. Goal: AI use shrinks as data grows.

## Build order

- V1: basket + budget, barcode + photo capture, Gemini tag read, source/confidence tracking, shared DB, offline catalog.
- Then: receipt scanning → price history + trip summaries → pre-trip lists + cross-store comparison (info only).
- Later: Expo app (reuse shared pkg) or Capacitor wrap, name matching, in-house tag reader, data products.

## Constraints (checked Oct 2026 — re-confirm)

- Workers free: ~100k req/day, ~30ms CPU/req → resize photos in browser, never in Worker.
- R2 free: 10 GB, 1M writes, 10M reads/mo.
- Neon free: 0.5 GB, 100 CU-hours, scale-to-zero after 5 min (slow first query), PostGIS ok. Plan roll-up of old observations before 0.5 GB fills.

## Open risks

- Walk target stores: tag contents (barcode/QR/neither)? Any QR→price?
- Domain/GitHub/trademark check for "Tally" (crowded name).
- Confirm retailers publishing prices online + terms before pulling. Leads (Oct 2026, via Exa): CAC Jamaica publishes grocery price surveys (cac.gov.jm); PriceSmart Jamaica lists prices online (pricesmart.com/en-jm); PriceRunJA scrapes 5 chains (~45k products) — both a feasibility signal and competition.
- Confirm Gemini quota/cost + current GCT exemption rules per category.
- Cold start: seed 150–200 items at 1–2 Montego Bay stores before real users.
- OCR struggles: glare, curved tags, handwritten stickers → retake flow + tap-to-pick.
- Adoption risk: depth in one town first.

## Monorepo layout

- `apps/web` — Vite + React PWA · `apps/api` — Hono on Workers · `apps/landing` — Astro
- `packages/shared` — types, validation, resolution + confidence logic (reused by web, api, future Expo app)

## Working agreements for Pi

Also follow the global contract in `~/.pi/agent/AGENTS.md`: restate the task + "done" first, plan-then-approve for multi-file work (via `/pt`), PROGRESS.md on large work, no stubs, run-don't-claim (show output), max 3 questions with recommended answers, ask before destructive/irreversible actions.

### Autonomous skill use (standing instruction — do not wait to be told)

Match tasks to skill descriptions yourself and load matching skills without asking the user. Read a skill's `SKILL.md` only when you start the matched task — never pre-read skill files. If you miss a relevant skill, say so and load it before retrying.

Default mappings (not exhaustive — match on description when in doubt):
- Writing/reviewing Workers, wrangler, R2, Cron config → `workers-best-practices` + `wrangler`
- Any Hono code (routes, middleware, validation) → `hono`
- Any Postgres/Neon/Drizzle schema, migration, or query → `supabase-postgres-best-practices`
- Any React component, PWA screen, or UI review → `vercel-react-best-practices` + `vercel-composition-patterns` (+ `frontend-ui-engineering` for new screens, `web-design-guidelines` for review passes)
- Multi-file feature work → `planning-and-task-breakdown`, then `incremental-implementation`
- New logic or behavior change → `test-driven-development`; before merge → `code-review-and-quality`
- Untrusted input, auth, privacy-adjacent code → `security-and-hardening`
- Perf budgets, Worker CPU, bundle size, Core Web Vitals → `performance-optimization` (+ `web-perf` for web)
- API shapes, shared contracts → `api-and-interface-design`; anything failing → `debugging-and-error-recovery`; messy but working code → `code-simplification`; every commit → `git-workflow-and-versioning`
- Framework docs in doubt → Context7 MCP (`query_docs`); external facts (retailers, GCT, DPA) → Exa MCP.

### Autonomous MCP use (standing instruction — do not wait to be told)

Use MCP tools yourself whenever the task calls for them — never wait to be told, never ask permission to look something up:
- Framework, library, or runtime API questions (Hono, Drizzle, Vite, React, Astro, Workers) → Context7 (`resolve_library_id`, then `query_docs`). Prefer it over memory.
- External facts — retailer price pages, GCT rules, Jamaica Data Protection Act, competitor landscape → Exa (`web_search_exa`, then `web_fetch_exa`).
- Anything living in Postgres (schema, data checks, `EXPLAIN`) → Neon MCP once signed in, else `psql` with `.env`.

Available skills (`.agents/skills/`, auto-loaded): `hono`, `workers-best-practices`, `wrangler`, `web-perf` (API + PWA perf); `vercel-react-best-practices`, `vercel-composition-patterns`, `web-design-guidelines`, `frontend-ui-engineering` (web UI); `supabase-postgres-best-practices` (Neon/Postgres schema); `impeccable` (`.pi/skills/` — design critique, audit, polish; 59 deterministic anti-pattern rules, no LLM needed). workflow: all 25 skills from `TheForgivenOne/agent-skills` (build loop, review, testing, docs, shipping, constraints, meta). MCP: `neon` remote server in `.pi/mcp.json` (OAuth — run `/mcp login neon` in an interactive session). Extension: `pi-subagents` (project package in `.pi/settings.json` — delegate reviews, plan second-opinions, and parallel audits to child agents instead of doing them inline). Workflow: `pi-plan-task` (`/pt` — Plan → Review → Approve → Build → Verify; nothing touches source until the plan is approved; tasks complete only on verified checks; state survives across sessions). Always write the `/goal` into a presented plan (objective + done criteria as a plan section); it activates on plan approval. Approval means the recommended picks for any unanswered plan questions — only explicit picks override them. Review agents (`.pi/agents/`, via `pi-subagents` — all inherit project context): `code-reviewer`, `security-auditor`, `test-engineer`, `web-performance-auditor`. Slash commands (`.pi/prompts/`, all from `TheForgivenOne/agent-skills` `commands/`): `/spec` → `/planning` → `/build` loop, `/test`, `/review`, `/ship` (parallel fan-out to the 3 review agents + go/no-go), `/webperf`, `/code-simplify`, `/constraints` (plus Tally's own `/plan-v1`, `/price-check`, `/privacy-check`).

- Small, reviewable diffs. Monorepo-aware edits (shared logic lives in `packages/shared`, never duplicated).
- Privacy invariants are hard rules: no user/device IDs in shared schema, no whole shelf photos stored, receipts discarded after extraction.
- Every price path must carry `{ source, age, confidence }` and an exact/estimated label.
- Confirm free-tier-sensitive choices (Worker CPU, R2, Neon) before implementing.
