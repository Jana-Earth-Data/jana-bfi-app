# Session Restart — jana-bfi-demo — 2026-09-07

## Working branch

`feature/20260907_1` (created this session, cut from `development`)

Old branch `feature/20260825_1` has been deleted locally and remotely.

## What we were doing

Fixing extreme slowness on the Vercel deployment. Everything was taking minutes — bank selection, officer selection, My Work queue loading.

## Root cause

The precomputed portfolio file (`lib/demo/precomputed-portfolio.json.gz`, 2.7 MB, 80K loans) was never being generated during Vercel builds. Every serverless cold start fell back to synthesizing 80,035 loans in-memory (~50 seconds). Vercel functions go cold frequently, so this happened on nearly every request.

## Fixes applied (3 commits, all merged to development AND main)

1. **`vercel.json`** (PR #29/#30) — Changed `buildCommand` from `"JANA_DEMO=1 next build"` to `"npm run build:demo"`. The direct `next build` call skipped the npm `prebuild` hook that generates the precomputed portfolio.

2. **`.vercelignore`** (PR #33/#34) — Removed `scripts/` exclusions. The prebuild guards and precompute scripts need to be present during Vercel builds. The `check-dockerignore-build-scripts.mjs` guard also reads `scripts/supabase-origin-column.sql` at build time.

3. **`scripts/check-docker-demo-flag.mjs`** (PR #35/#36) — Made the Docker-specific guard skip gracefully (`exit 0`) when the Dockerfile is absent. Vercel's `.vercelignore` excludes the Dockerfile, so this guard always failed on Vercel.

## Update 2026-09-07 (later) — SECOND root cause found and fixed

The precompute fix above was correct and DID deploy. But the site was still
taking ~3 minutes to reach the first screen. Vercel runtime logs showed the
real remaining bottleneck.

### Evidence
- Expanded a `GET /` request in Vercel logs: **Execution Duration 1m 13s**,
  External API = `GET .../rest/v1/bfi_pcaf_availability`.
- The `/` SSR page (`app/page.tsx`) is `force-dynamic`, so it re-renders
  server-side on every load and `await`s a Supabase overlay query with no
  timeout.
- `bfi_pcaf_availability` is tiny and indexed on `bank_id` → the query is
  milliseconds when it responds. Supabase is in Mumbai `ap-south-1`, same
  region as Vercel `bom1` → not latency. Fast locally, slow only on Vercel,
  every cache-cleared render.
- Conclusion: a **Vercel-serverless connection stall on the Supabase REST
  fetch**. The Supabase JS client uses global `fetch` with no default
  timeout, so a wedged connection hangs the whole render for ~73s.

### Fix (2 layers, this branch, NOT yet merged)
1. `lib/data/supabase.ts` — pass a custom `global.fetch` to `createClient`
   that attaches `AbortSignal.timeout(5s)` (via `AbortSignal.any` to respect
   caller signals). Bounds EVERY server-side Supabase call across all 30
   route/page files, so no REST call can hang a function for 73s again.
2. `app/page.tsx` — wrap `applyOfficerPcafOverlay(...)` in a new
   `withDeadline(promise, 2000)` helper (`lib/async/deadline.ts`). If the
   overlay does not answer in 2s, render the precomputed `base` immediately.
   The overlay is an enhancement, never a first-paint blocker; officer
   re-scores reconcile on the next client fetch.

Verified with a full production `next build` in Docker (`docker compose build
web`) — passes clean, Node 20.20.2 in the container.

### To verify after deploy
- Entry screen should appear in <2s even on a cold render.
- Vercel `GET /` execution duration should drop from ~73s to <2s.
- If Supabase is healthy the officer PCAF overlay still applies; if it stalls,
  the page renders base instead of hanging.

---

## Prior status — precompute fix (2026-09-07 earlier) — DEPLOYED, confirmed working

The Vercel free tier CPU limit had been exceeded (6h 9m / 4h) — caused by the
50s cold starts. The precompute fixes are merged to `main` and did deploy;
`[portfolio] loaded precomputed` now runs (portfolio synthesis is no longer
the bottleneck).

The precompute deploy did:
- Run `npm run build:demo` → prebuild hook → precompute portfolio
- All 8 prebuild guards pass (Docker guard skips on Vercel)
- Precomputed portfolio included in bundle
- Cold starts for portfolio drop from ~50s to <1s (load gzipped file)

## Remaining production readiness work (separate from this fix)

See `CLAUDE.md` in this repo for the full list. Key items:
- CI/CD pipeline (GitHub Actions)
- Supabase backups
- Structured logging
- CSP/HSTS security headers
- SIGTERM graceful shutdown
- `esrm-tab.tsx` decomposition (~3,100 lines)
- Automated tests

Detailed docs: `CODE_REVIEW_REPORT.md`, `PRODUCTION_READINESS_ASSESSMENT.md`, `ARCHITECTURE.md`

## Git state

- **Current branch:** `feature/20260907_1`
- **development:** up to date with all fixes
- **main:** up to date with all fixes
- **Untracked files:** `CODE_REVIEW_REPORT.md`, `PRODUCTION_READINESS_ASSESSMENT.md`, `DEPLOYMENT_CONFIG_ANALYSIS.md`, `session_restart.md` (review artifacts, intentionally not committed)
