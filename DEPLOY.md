# Tally deploy runbook

Everything below needs a human with logins — nothing here runs headless.
Code is deploy-ready when all workspace gates pass (`pnpm -r typecheck`,
`pnpm -r test` with `DATABASE_URL` set, web + landing builds, and
`wrangler deploy --dry-run` in `apps/api`). Last verified state: PROGRESS.md.

## 0. Prereqs

- `wrangler login` (Cloudflare) · Neon `DATABASE_URL` (pooled) · Gemini key
  (OpenAI-compatible; defaults to `https://generativelanguage.googleapis.com/v1beta/openai`, model `gemini-2.0-flash`)
- Generate: `openssl rand -base64 32` → `BETTER_AUTH_SECRET`

## 1. API (Workers)

```sh
cd apps/api
wrangler secret put DATABASE_URL        # Neon pooled connection string
wrangler secret put BETTER_AUTH_SECRET  # 32+ random bytes
wrangler secret put OPENAI_API_KEY      # Gemini key
wrangler deploy
```

Optional plain vars (`wrangler deploy --var KEY:VALUE`, or `wrangler.toml`):

- `BETTER_AUTH_URL` — public API origin, e.g. `https://tally-api.<you>.workers.dev`
- `TRUSTED_ORIGINS` — comma-separated web origins allowed cookie auth,
  e.g. `https://tally.pages.dev` (explicit — never `*`)
- `VISION_MODEL`, `OPENAI_BASE_URL` — only if leaving Gemini defaults

Deploy enables the daily 04:00 UTC auth sweep (`[triggers]` cron).

Verify:

```sh
curl https://<api>/health
# {"status":"ok"}
curl https://<api>/catalog/store-demo-1
# {"version":1,...,"entries":[]} — empty until first reports land
```

Auth smoke test: `POST https://<api>/api/auth/sign-in/anonymous` → 200 +
`better-auth.session_token` cookie; `GET https://<api>/api/auth/get-session`
with that cookie → `{user:{...}}`.

## 2. R2 catalog (per store)

```sh
wrangler r2 bucket create tally-catalog
```

Add the binding to `apps/api/wrangler.toml` (needs a commit after first deploy):

```toml
[[r2_buckets]]
binding = "CATALOG"
bucket_name = "tally-catalog"
```

Seed + upload per store (uses live `current_prices`, contract-validated):

```sh
cd apps/api
DATABASE_URL="<pooled>" pnpm seed -- --store <store-id> --out catalog.json --from-db
wrangler r2 object put tally-catalog/<store-id>.json --file=catalog.json
```

Serving from R2 (Workers Cache API) is a later optimization — today the web
app reads `/catalog/:storeId` from the API and caches in Dexie.

## 3. Web PWA (Cloudflare Pages or any static host)

```sh
cd apps/web
VITE_API_BASE=https://<api> pnpm build   # dist/
```

Publish `dist/`. Then on a phone: pick store → capture works against the
deployed API; offline serves the Dexie-cached catalog.

## 4. Landing (static)

```sh
cd apps/landing
pnpm build   # dist/
```

Publish `dist/` wherever the marketing origin lives.

## 5. Post-deploy checks

- Tag read end-to-end (photo → price → basket) on a real phone
- Second identical photo returns `cached:true` without a model call
- Cross-origin cookies: device session persists (caps keyed per device, not IP)
- Neon dashboard: `price_observations` growing, `current_prices` fresh,
  `auth_*` rows swept daily, well under 0.5 GB
- Worker metrics: CPU well under ~30 ms/req; R2 within free limits

## Rollback

Workers keeps every deployment: `wrangler rollback` (or roll back in the
dashboard). No data migration to undo — `price_observations` is append-only
and additive migrations only add tables/columns.
