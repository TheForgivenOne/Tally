---
description: Build the Tally V1 slice step by step
---
# Tally V1 build plan

Execute the V1 slice from AGENTS.md. Work in order, one step at a time:

1. `packages/shared` — price types, source enum (cache/tag/barcode-cache/web/ai), confidence + error-band logic, resolution-order function.
2. `apps/api` — Hono skeleton on Workers: report price, resolve price, consensus derivation stub. Privacy check: reject any user/device ID on shared routes.
3. `apps/web` — PWA shell: Home → store pick → budget → shopping screen (live camera, pinned total + budget bar, capture, mascot) → item card (exact/estimated, qty) → basket with undo → budget warnings → end trip.
4. Offline: Dexie queue + per-store catalog JSON from R2.
5. Tag OCR path: browser resize → Gemini vision → source/confidence stored.

Keep diffs small. After each step, state what changed and what's next.
