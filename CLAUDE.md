# CLAUDE.md — jana-bfi-app

## What this is

**This is the production application banks and financial institutions use. It is not demo code.**
That distinction matters and has been got wrong before — the repo was called `jana-bfi-demo` until
24 September 2026, and the name outlived the truth by some margin.

Next.js 15 application for the Nepal banking sector, covering five regulatory frameworks (NRB ESRM,
Green Finance Taxonomy, PCAF, IFC Performance Standards, CAP/Monitoring) plus NFRS S1/S2 disclosure.
Deployed on Vercel.

**Demo mode is a built-in product capability, not the product.** A single build ships two modes,
toggled at runtime: *live* (real officer captures via Supabase, empty loan book) and *demo* (an
80,000-loan fabricated portfolio). Demo mode exists for sales and for officer training, and the
separation is enforced — see the `lib/demo` boundary, the `JANA_DEMO` build flag, the DEMO MODE
banner, and the provenance column that keeps demo captures out of live data.

So: `lib/regulatory` is production regulatory logic and is held to that standard. `lib/demo` is
fixture generation. Fabricated data in `lib/regulatory` is a defect — that is what the Tier N0 tasks
in the NFRS backlog exist to find.

## Session startup — read these to know what's next (in order)

At the start of every session, read these files **in this order** to reconstruct
"where we are and what's next". They are listed most-authoritative first.

1. **`PROJECT_PLAN.md` — the source of truth for status.** Read two things:
   - The **task tables** (§3 onward): each row has a status glyph — `☐` not
     started · `◐` in progress · `☑` done · `⊘` dropped. The next task is the
     first `☐`/`◐` in phase order (P0 → PR0 → P1 → PR1 → …). PR0 sits **between
     P0 and P1** and is the current correctness gate — do it before any P1 work.
   - **§13 Changelog** (newest-first): the top row is the most recent landed
     work. Per the §0 maintenance protocol, a task is not "done" until it appears
     here as ☑ with its commit/PR. A row whose Commit/PR column still says
     `_this PR_` is landed-but-not-yet-backfilled — resolve it to real refs
     after merge.
2. **`docs/NFRS_REMEDIATION_BACKLOG.md` — per-task detail for the PR0–PR4/PRD
   regulatory phases (the N-tasks).** PROJECT_PLAN carries *status*; this file
   carries the *why/where* (finding, evidence `file:line`, demo-vs-live
   behaviour, effort). Its glyphs are kept in sync with PROJECT_PLAN. Read the
   Tier N0 rows before touching any regulatory arithmetic.
3. **`docs/NFRS_S1_S2_GAP_ANALYSIS.md`** — the standards analysis the N-tasks
   trace back to (the "§X.Y" references in the backlog/plan point here).
4. **`session_restart.md`** — free-form current-session scratch context (working
   branch, in-flight experiment notes). Least authoritative; may lag the plan.
5. **Verify the live state**, don't trust docs alone:
   - `git rev-parse --abbrev-ref HEAD` — confirm the working branch (see Git
     workflow below; **do not** create a new branch on your own).
   - `git log --oneline -5` — the real tip vs. what the changelog claims.
   - `gh pr list` — any open PR (e.g. PR0-a) whose merge + `_this PR_` backfill
     is the actual next step.

**PR0 sub-PR strategy (in flight):** PR0 is split by risk — PR0-a (N0.8/N0.9/
N0.10, arithmetic-neutral) → PR0-b (N0.6/N0.7/N0.3/N0.2, small reviewed nudges)
→ PR0-c (N0.1/N0.4/N0.5, heavy structural). The `check-regulatory-boundary.mjs`
guard grandfathers the not-yet-moved constants; each PR0-b/c task removes its
baseline entry as it relocates the constant into `lib/regulatory`.

## Production readiness work — status as of 2026-09-15

A full code review and production readiness assessment were completed. Four hardening phases have been done. September work added the phased production plan, the test strategy, and the Vercel performance fixes. Remaining work is documented below.

### Key documents (read these before resuming)

- `PROJECT_PLAN.md` — phased plan to production, with the PR-cadence maintenance protocol. Dated 2026-09-09. **Start here.**
- `TEST_STRATEGY.md` — proposed test approach. Dated 2026-09-09. Nothing wired up yet; §8 records the current zero-test baseline.
- `CODE_REVIEW_REPORT.md` — full codebase audit (41 routes, ~42 components, ~65 lib modules). 0 critical, 3 high, 9 medium, 9 low findings.
- `PRODUCTION_READINESS_ASSESSMENT.md` — scored assessment with remediation roadmap.
- `DEPLOYMENT_CONFIG_ANALYSIS.md` — Vercel and Next.js configuration inventory and analysis.
- `docs/ARCHITECTURE.md` — technical architecture with mermaid diagrams. (Note the `docs/` prefix.)
- `session_restart.md` — current-session context: working branch and the Vercel performance work.

### Already completed (Phases 1-4)

- Rate limiting middleware (demo-exempt)
- Health check endpoint + Dockerfile HEALTHCHECK
- Shared route helpers (eliminated boilerplate across 41 routes)
- Request body size guard (256 KB)
- MIME type + magic byte validation on upload
- Async gzip I/O on cold start
- Admin auth accepts Bearer header
- Dead code removal
- Vercel deployment fix (`JANA_DEMO=1`)
- Centralized constants

### Remaining Phase 1 (high priority)

1. CI/CD pipeline (GitHub Actions) — ~1 day
2. Supabase backups — ~2 hours (critical for officer data)
3. Structured logging (replace console.*) — ~1 day
4. CSP and security headers — ~4 hours
5. SIGTERM graceful shutdown — ~4 hours
6. Rollback procedure documentation — ~2 hours
7. Admin token query string normalization

### Remaining Phase 2 (production hardening, if needed)

- Error tracking (Sentry)
- Database migration system
- Unit tests for regulatory logic
- Server-side session state
- Metrics/APM integration
- CDN deployment
- Supabase client reconnection
- Horizontal scaling
- E2E tests (Playwright)

### Open high-severity code review items

- `components/bfi/tabs/esrm-tab.tsx` is ~3,140 lines — needs decomposition. (There is no `src/` directory in this repo; earlier revisions of this file cited `src/components/esrm-tab.tsx`, which does not exist.)
- No automated tests exist — see `TEST_STRATEGY.md` for the proposed remedy.

## Git workflow

Uses the standard feature branch workflow from the parent CLAUDE.md. Current working branch: `feature/20260923_1`. Target: `main` (via `development`). Earlier branches (`feature/20260825_1`, `feature/20260907_1`) have been merged and deleted.
