# Project Plan — jana-bfi-demo → Production

**Date:** 2026-09-09
**Target end-state:** **Production** — a real bank (Nepal BFI) relying on real
regulatory numbers (PCAF financed emissions, NRB ESRM/ESDD risk classes, Green
Finance Taxonomy classifications) computed by this application and filed with
Nepal Rastra Bank.
**Branch model:** `feature/<date>_N` → `development` → `main` (Vercel deploys
from `main`). See `CLAUDE.md`.

---

## 0. How to read this plan

This plan synthesises every open item from the three assessment documents into
a single sequenced roadmap:

- `CODE_REVIEW_REPORT.md` — code-level findings (0 critical, 3 high, 9 medium, 9 low)
- `PRODUCTION_READINESS_ASSESSMENT.md` — operational readiness (scalability, reliability, durability, security, deployability, **test coverage**)
- `TEST_STRATEGY.md` — the testing plan referenced throughout Phase 1–2

Each phase has an **objective**, a **task table** (with status, source
reference, and effort), **dependencies**, and an **exit criterion** — the gate
that must be true before the phase is considered done. Effort is in
engineer-days unless noted.

**Guiding principle for a banking product:** correctness of the regulatory
computation is non-negotiable and comes first. Operational hardening (scaling,
CDN, APM) is real but secondary to "the number is right and we can prove it
with a test that runs on every change."

### Maintenance protocol (read before editing)

**This document is the single source of truth for project status. It is
maintained in-repo, updated on the PR that ships each task — not in a separate
tracker.** The rule:

1. **The PR that completes a task updates this file in the same PR.** Flip the
   task's status (see legend), and add a dated line to the Changelog (§13)
   naming the task ID and the merge commit/PR. A task is not "done" until this
   file says so.
2. **Status lives in the `S` column** of each task table, using the legend
   below. Keep it to one glyph so tables stay readable.
3. **When scope changes** (a task splits, an item is added or dropped), edit the
   task table **and** the dependency graph (§9) together so they never
   disagree.
4. **When a phase's exit criterion is met**, mark the milestone (§11) and note
   it in the Changelog.
5. **Do not** let this file drift behind `main`. If you notice merged work not
   reflected here, fixing it is in scope (boy-scout rule).

**Status legend (`S` column):**

| Glyph | Meaning |
|-------|---------|
| ☐ | Not started |
| ◐ | In progress |
| ☑ | Done (Changelog entry required) |
| ⊘ | Dropped / not applicable (note why in Changelog) |

---

## 1. Current state (baseline, 2026-09-09)

**What is solid:**
- Strong application-layer security (tenant isolation, owner-only enforcement, input validation, no secrets in code).
- Clean demo/live build-time boundary, enforced by 9 build guard scripts.
- Well-engineered multi-stage Docker build with working HEALTHCHECK.
- Excellent inline documentation.
- Recently shipped: exit-demo flow, healthcheck IPv4 fix, rate limiting, body-size guards, MIME validation, shared route helpers, async cold-start I/O.

**What blocks production:**
- **The disclosed number depends on the code path, not just the data** — `NFRS_S1_S2_GAP_ANALYSIS.md` found demo and live differ in *computation* (duplicated aggregator pair already out of step, two different EV floors, demo-only rules living inside `lib/regulatory/`). Until fixed, the demo proves nothing about what live will compute, and no test written against the regulatory core is meaningful. Scheduled as **Phase PR0** (Tier N0). This is the new highest-priority correctness gate.
- **Zero automated tests** — the ~8,200 lines of regulatory logic have no behavioural verification.
- ~~**No CI/CD**~~ — RESOLVED (P0.1): `.github/workflows/ci.yml` now runs lint, type-check, an `npm audit` gate (P0.6), the 9 build guards, and a real demo+live Docker image build on every push/PR. Branch protection to enforce it is still pending (P0.5).
- **No Supabase backups / PITR** — officer captures are unrecoverable if lost.
- **No database migration system** — schema applied by hand; two copies can drift.
- **Observability is `console.log`** — no structured logging, no error tracking, no metrics.
- **Missing security headers** — no CSP, no HSTS.
- **No graceful shutdown** — SIGTERM drops in-flight requests.
- **No horizontal scaling / rollback procedure.**
- **One 3,100-line component** (`esrm-tab.tsx`) that is hard to test and maintain.

---

## 2. Phase overview

| Phase | Theme | Objective | Est. duration |
|-------|-------|-----------|---------------|
| **P0** | Foundation | CI/CD + test harness skeleton. Nothing merges without passing checks. | ~1 week |
| **PR0** | Regulatory integrity | One computation, two providers. Remove every place demo and live differ in arithmetic, thresholds, or method strings. The disclosed number becomes a function of data alone. | ~2 weeks |
| **P1** | Correctness | 100% tested regulatory core + API route tests. The (now provider-independent) numbers are provably right. | ~2 weeks |
| **PR1** | B62 compliance | Make the financed-emissions disclosure satisfy S2 B62(a)–(d) in full — gross exposure, industry × asset-class matrix, scope split, GICS, per-class attribution, derived methodology. | ~6.5 weeks |
| **PR2** | The bank's own footprint | Scope 1 + location-based Scope 2 capture; resolve the hydro CH₄/CO₂ contradiction; emission-factor registry. | ~2.5 weeks |
| **P2** | Durability | Backups, migrations, graceful shutdown, session persistence. Data survives. | ~1.5 weeks |
| **P3** | Observability & Security | Structured logging, error tracking, metrics, CSP/HSTS, admin audit. We can see and defend. | ~1.5 weeks |
| **PR3** | The three missing pillars | Governance, strategy, risk-management, targets, cross-industry metrics, and scenario analysis (S2 §§6–36, §22). | ~9 weeks |
| **P4** | Scale & Resilience | Multi-replica, CDN, reconnection, circuit breakers, component decomposition, E2E. It holds up. | ~2–3 weeks |
| **PR4** | Presentation mechanics | Comparatives + restatement, materiality judgements, connected information, measurement uncertainty, transition-relief flags. | ~2.5 weeks |
| **PRD** | Regulatory documentation | Retire over-claims, correct citations, document the demo/live computation boundary, add NRB Chapter VIII. Runs alongside the PR phases. | ~1.5 weeks |
| **P5** | Go-live | Staging parity, pilot, runbooks, rollback drill. Ship with confidence. | ~1 week |

Total: the original P0–P5 hardening is roughly **9–10 engineer-weeks**. The NFRS
regulatory work (PR0–PR4 + PRD, sourced from `NFRS_REMEDIATION_BACKLOG.md`) adds
roughly **24 engineer-weeks** (~120 days, of which N3.8 scenario analysis alone
is 20+ days), so the two workstreams together are a multi-quarter programme, not
a single sprint. They are sequenced — not additive-in-parallel — because the PR
phases and the P phases share the same `lib/regulatory/**` surface and the same
100% coverage gate (P1.5).

**Why the PR phases interleave with the P phases the way they do:** PR0
(integrity) must precede P1, because a test written against a regulatory
function that can return two answers depending on the serving path verifies
nothing. Once PR0 makes the computation provider-independent, P1 locks the
corrected core at 100% coverage, and every subsequent PR phase inherits that
gate (budget ~+40% on PR0–PR2 for the tests each new/changed regulatory path
requires — see backlog §8). PR3's scenario-analysis build (N3.8) is the
commercial pivot and depends on PR1 being complete, so it sits late.

---

## 3. Phase P0 — Foundation (CI/CD + test harness)

**Objective:** Establish the mechanism that makes every later phase enforceable.
No code should be able to merge that fails lint, type-check, the build guards,
the build, or (as they accrue) the tests.

| S | # | Task | Source | Effort |
|---|---|------|--------|--------|
| ☑ | P0.1 | Create `.github/workflows/ci.yml` — runs on push + PR. `checks` job runs in `node:20-alpine`: `npm ci`, `lint`, `type-check`, `prebuild` (8 guards). `docker-build` job builds the real production image both ways (`JANA_DEMO=1` demo + `JANA_DEMO=0` live), subsuming `build:demo`/`build:live`. All testing runs in Docker — no local toolchain. | PRA §5.2, CRR §4.5 | 1 |
| ☑ | P0.2 | Install Vitest + `@vitest/coverage-v8` + `@testing-library/react` (+ `@testing-library/dom`) + `msw` + `jsdom` + `@vitejs/plugin-react`; add `vitest.config.mts` (`.mts` so the ESM config loads without flipping the CJS root to `type:module`) wired to the `@/` alias, `node` env default, `hookTimeout` 60s, and a `tests/global-setup.ts` that runs the existing `precompute-portfolio` step ONCE (writing the gz `getPortfolio()` prefers) so the goldens gunzip (~300ms) instead of re-synthesizing per file — the fix for the CI hook-timeout under Vitest's per-file worker isolation. | TS §2 | 1 |
| ☑ | P0.3 | Add `test`, `test:unit`, `test:watch`, `test:coverage` scripts to `package.json` | TS §5.1 | 0.5 |
| ☑ | P0.4 | Add `Test (report-only coverage)` step to the CI `checks` job (`npm run test:coverage`, v8, NO threshold gate yet — gate arrives P1.5). `tests/vitest-globals.d.ts` gives `tsc` the Vitest globals without an explicit `types` array. | TS §5.2 | 0.5 |
| ☐ | P0.5 | Add branch protection on `main`/`development` requiring CI to pass | PRA §5.2 | 0.5 |
| ☑ | P0.6 | `npm audit --audit-level=high` CI step (fails on high/critical; the two pre-existing transitive `uuid`←`exceljs` **moderates** do not block — fix needs a breaking `exceljs@3.x` downgrade). All top-level deps pinned to exact versions matching the lockfile (no caret ranges); `npm ci` verified in Docker. | CRR §6.1, §6.2 | 0.5 |

**Dependencies:** none — this is the entry point.
**Exit criterion:** A PR that breaks lint/types/guards/build is automatically
blocked from merge. `npm test` exists and runs (even with one trivial test).

---

## 3a. Phase PR0 — Regulatory integrity (Tier N0)

**Objective:** Make the disclosed number a function of **data alone**, never of
the code path that served the request. Today `buildSummary()` (demo) and
`recomputeSummary()` (live) are a duplicated aggregator pair that is already out
of step; the enterprise-value floor differs between paths; a demo-only
reduction-target hash and name-substring PCAF scoring live *inside*
`lib/regulatory/`. Until these are collapsed, the demo proves nothing about live
and no P1 test is meaningful. **This phase precedes P1.**

**Governing principle — one computation, two providers.** Everything that
decides a regulatory number lives in `lib/regulatory/**` as pure functions over
a normalised domain model. `lib/demo/**` and the live provider differ only in
*which data populates that model* — never in arithmetic, thresholds, floors, or
method strings. (Full statement: `NFRS_REMEDIATION_BACKLOG.md` §0.)

| S | # | Task | Source | Demo | Live | Effort |
|---|---|------|--------|------|------|--------|
| ☐ | N0.1 | **Collapse the duplicated aggregator pair.** One `summarise()` in `lib/regulatory`, called by both providers; delete `recomputeSummary()`. | Backlog N0.1; GA §2.2 | shared | shared | 2 |
| ☐ | N0.2 | **Single EV-floor policy**, defined + cited to PCAF Part A once in `lib/regulatory/pcaf`; remove both local floors (`portfolio.ts:345`, `api/bfi.ts:190`). | Backlog N0.2; GA §2.2 | shared | shared | 1 |
| ☐ | N0.3 | **Move the demo-only reduction-target hash out of `lib/regulatory`.** `stableHash(...) % 100 < 15` + canned strings at `climate/infer.ts:250–268` is inherited by live. | Backlog N0.3; GA §6.3 | demo seed | removed | 1 |
| ☐ | N0.4 | **Evidence-driven PCAF scoring** replacing name-substring fixtures. Demo seeds evidence documents; `pcaf/scoring.ts` reads them. Delete `PCAF_NAME_FIXTURES_*` + the second list in `entities.ts:212`. | Backlog N0.4; GA §6.1 | seeded evidence | shared | 3 |
| ☐ | N0.5 | **Retail factor: derive or disclose.** `RETAIL_TCO2E_PER_NPR = 6e-6` was tuned to keep the headline under 10M tCO₂e — source it to a published factor or exclude retail and say so. | Backlog N0.5; GA §6.2 | shared | shared | 1.5 |
| ☐ | N0.6 | **Dated FX rate.** Replace undated `NPR_PER_USD = 133.5` (`units.ts:19`) with a dated rate carried on the reporting period (S1 §24). | Backlog N0.6; GA §6.4 | shared | shared | 1.5 |
| ☐ | N0.7 | **Single reporting-period source.** Four hardcodings of the 2024/2025 boundary + `AS_OF_DATE` disagreeing with the `/api/pcaf/scores` docstring — derive from ingested coverage. | Backlog N0.7; GA §6.5 | shared | shared | 2 |
| ☑ | N0.8 | **Fix `bankClassForTenant()`** — returned `"A"` unconditionally, ignoring its argument. Bank class is now a `TenantConfig.bankClass` field (`lib/tenants/types.ts`), set per tenant in the registry, read by the function. Both demo tenants are Class A → zero figure movement (PR0-a). | Backlog N0.8; GA §6.6 | shared | shared | 0.25 |
| ☑ | N0.9 | **Corrected the disclosure-preview citation** (`nfrs-tab.tsx:468–476`): dropped the fabricated "NFRS draft §17(b)", re-pointed the financed-emissions requirement to IFRS S2 Appendix B (B58–B63; B62(d) allocation-method disclosure), and framed PCAF as the *chosen* method, not a standard mandate. | Backlog N0.9; GA §7.2 | shared | shared | 0.25 |
| ☑ | N0.10 | **CI guard added** — `scripts/check-regulatory-boundary.mjs`, wired into `prebuild` (8th guard) and run by CI. Fails on any *new* policy constant / duplicated aggregator outside `lib/regulatory`; grandfathers the four known N0.1/N0.5/N0.6/N0.7 occurrences (warn-only) so PR0-b/c tighten the net as each is relocated. | Backlog N0.10; §0 principle | — | — | 1 |

**Baseline pinned (done — precedes the N0 edits above).** Characterization
("golden") tests now freeze today's disclosed figures so every N0 change is a
reviewed diff, not an accident: `tests/golden/demo-portfolio.golden.test.ts`
(totals, NRB taxonomy count + NPR-weighted, scoping funnel, DQ 1–5 distribution,
15-row sector table, 2021–2025 trend), `tests/golden/live-overlay.golden.test.ts`
(the demo/live aggregator equivalence N0.1 will collapse), and
`tests/golden/pcaf-scoring.golden.test.ts` (score histogram for N0.4; the
70,000-loan retail-pool contribution of 2,044,419 tCO₂e for N0.5). Captured
deterministically (seed `0xb1f0b1f0`), verified identical across runs. Headline
baseline: **80,035 loans → 9,774,371 tCO₂e**, weighted DQ 3.8.

**Dependencies:** P0 (CI + guards to enforce N0.10). Test obligation folds into
P1 — do not close PR0 as "done" until the P1 tests for the collapsed
`summarise()` and evidence-driven scoring exist.
**Exit criterion:** the same inputs produce the same disclosed figure regardless
of provider, and no value reaching a disclosure originates in `lib/demo` or a
name list. Effort ≈ **10.5 days** (backlog §7).

---

## 4. Phase P1 — Correctness (the regulatory core)

**Objective:** Every regulatory number the product emits is verified by a test
derived from the regulation, and no future change can silently break one. This
is the heart of a banking product.

| S | # | Task | Source | Effort |
|---|---|------|--------|--------|
| ☐ | P1.1 | Tier 1 tests — PCAF scoring (`pcaf/scoring.ts`): one case per §5 option × asset class, out-of-scope, fail-down | TS §4.1 | 2 |
| ☐ | P1.2 | Tier 1 tests — ESDD scoring (`esdd/scoring.ts`, `annex5b-pf-scoring.ts`): answer combos → each risk-class boundary | TS §4.1 | 2 |
| ☐ | P1.3 | Tier 1 tests — Taxonomy (`taxonomy/activities.ts`, `dnsh.ts`): table-driven, per-activity Green/Amber/Red + DNSH | TS §4.1 | 3 |
| ☐ | P1.4 | Tier 1 tests — CAP (`cap/library.ts`), hydro (`capacity.ts`), loan-category derive, PRNG determinism | TS §4.1 | 1.5 |
| ☐ | P1.5 | **Flip the hard gate:** `lib/regulatory/**` → 100% line + branch in `vitest.config.mts`, enforced in CI | TS §5.2 | 0.5 |
| ☐ | P1.6 | Tier 2 tests — API route handlers with mocked Supabase: happy path + auth-fail (no cross-tenant leak) + bad-input, for all 41 routes | TS §4.2 | 4 |
| ☐ | P1.7 | Fix any bugs surfaced by P1.1–P1.6 (expect some; this is the point) | — | buffer 2 |

**Dependencies:** P0 (harness + CI gate); **PR0** (integrity — the core must be
provider-independent before its behaviour is worth locking to 100%).
**Exit criterion:** `lib/regulatory/**` at 100% line+branch, CI-enforced; every
API route has happy/auth-fail/bad-input coverage; test cases cite the
regulation paragraph they verify. A regulatory branch cannot merge untested.

---

## 4a. Phase PR1 — B62 compliance (Tier N1)

**Objective:** Turn "we publish a financed-emissions figure" into "we satisfy
S2 B62(a)–(d)". Every figure traces to an input and a method. **Do not start
before PR0 and P1.** Each task carries a P1.5 test obligation.

| S | # | Task | Standard | Demo | Live | Effort |
|---|---|------|----------|------|------|--------|
| ☐ | N1.1 | **Gross exposure** per industry per asset class, funded carrying amount before loss allowance, presentation currency. | B62(b) | shared | needs bank loss-allowance field | 3 |
| ☐ | N1.2 | **Percentage of gross exposure included**, with excluded asset types named. Replaces the current facility-matched ÷ in-scope ratio (different denominator). | B62(c), (c)(i) | shared | shared | 2 |
| ☐ | N1.3 | **Exclude risk mitigants** from gross exposure, explicitly. | B62(c)(ii) | shared | shared | 1 |
| ☐ | N1.4 | **Undrawn loan commitments** as a first-class asset class, percentage disclosed separately from drawn. | B62(a)(ii), (c)(iii) | seed undrawn | needs CBS field | 3 |
| ☐ | N1.5 | **Industry × asset-class disaggregation** of absolute gross financed emissions. | B62(a) | shared | shared | 4 |
| ☐ | N1.6 | **Scope 1/2/3 split of financed emissions** within that matrix (borrower-level scope data or documented estimation basis). | B62(a) | shared | shared | 4 |
| ☐ | N1.7 | **NRB-sector → GICS 6-digit mapping table.** Confirmed mandatory (ND.2): the NFRS draft tracks pre-amendment IFRS S2 with no GICS alternative. Not contingent. | B62(a)(i) | shared | shared | 3 |
| ☐ | N1.8 | **Real asset-class router.** Implement the PCAF classes a Nepal commercial book contains; make the rest explicitly unsupported rather than silently unreachable. | B62(a)(ii), PCAF §5 | shared | shared | 4 |
| ☐ | N1.9 | **Per-asset-class attribution denominators** (EVIC §5.1, equity+debt §5.2, total project cost §5.3) — not one EV for everything. Fix the UI hint. | PCAF §5 | shared | shared | 3 |
| ☐ | N1.10 | **Derived methodology disclosure** replacing the hardcoded string: which option, denominator, factor source, per loan + aggregate. | B62(d), §29(a)(iii) | shared | shared | 2 |
| ☐ | N1.11 | **Extent of primary-activity data + extent of verified data** as disclosed metrics (PCAF evidence matrix holds most inputs). | B55–B56 | shared | shared | 2 |
| ☐ | N1.12 | **Consolidation approach** (equity share or control) as a configured, disclosed per-bank property. | B27 | shared | shared | 1 |

**Dependencies:** PR0, P1. N1.7 unblocked by ND.2 (vintage verified).
**Exit criterion:** the financed-emissions disclosure satisfies B62(a)–(d) in
full. Effort ≈ **32 days** (backlog §8).

---

## 4b. Phase PR2 — The bank's own footprint (Tier N2)

**Objective:** Disclose the bank's *own* Scope 1 and location-based Scope 2 —
currently absent entirely, and conspicuous in a "financed emissions platform" —
and put the GHG-factor mechanics on a documented footing.

| S | # | Task | Standard | Demo | Live | Effort |
|---|---|------|----------|------|------|--------|
| ☐ | N2.1 | **Scope 1 capture** — fuel, fleet, refrigerants — with evidence attachment. | §29(a)(i) | seeded | officer capture | 3 |
| ☐ | N2.2 | **Scope 2, location-based** (mandatory basis, B30). Market-based optional where contractual instruments exist. | §29(a)(v), B30–B31 | seeded | officer capture | 3 |
| ⊘ | N2.3 | ~~Seven-gas model~~ **Dropped** — B22 exempts CO₂e-basis factors from GWP recalculation, and every feed we have is CO₂e-basis. Residual obligation folded into N2.6. | B20–B22 | — | — | 0 |
| ☐ | N2.4 | **Resolve the hydro CH₄/CO₂ contradiction (up to 30× error).** `entities.ts:250` (`capacityMw × 15`, "tCO₂/MW/yr") vs `pcaf/scoring.ts:183,349` (same factor called an "IPCC 2019 reservoir **CH₄** EF"). Establish which is right; apply GWP₁₀₀ if gas-specific; align both modules. | B22, correctness | shared | shared | 1 |
| ☐ | N2.4b | **Cement factor is CO₂-basis — disclose it as such** (`CEMENT_TCO2_PER_TONNE = 0.75`, `entities.ts:78`). Understates by ~1%; a B29 disclosure fix, not a recalculation. | B29 | shared | shared | 0.25 |
| ☐ | N2.5 | **Scope 1/2 disaggregation** between consolidated group and other investees. | §29(a)(iv) | shared | shared | 1.5 |
| ☐ | N2.6 | **Emission-factor registry** — which factor, source, activity, with a CO₂e-converted / gas-specific basis flag. Gas-specific entries get latest-IPCC GWP₁₀₀ at computation; CO₂e used as-is (B22 exemption). | B29, B22 | shared | shared | 2.5 |

**Dependencies:** PR0, P1. N2.4 should precede any hydro-emissions test in P1.5.
**Exit criterion:** the bank's own Scope 1 + location-based Scope 2 are captured
and disclosed; every emission factor carries a documented basis. Effort ≈
**11.25 days** (backlog §8).

---

## 5. Phase P2 — Durability (data survives)

**Objective:** Officer work (ESDD responses, PCAF evidence, taxonomy
assessments, assignments, uploaded evidence files) is recoverable, schema
changes are versioned, and deploys don't drop in-flight work.

| S | # | Task | Source | Effort |
|---|---|------|--------|--------|
| ☐ | P2.1 | Enable Supabase automated backups + PITR (Pro plan); document RTO/RPO | PRA §3.1 | 0.5 |
| ☐ | P2.2 | Periodic export of all `bfi_*` tables to S3; test a restore to a clean instance | PRA §3.1 | 1 |
| ☐ | P2.3 | Adopt a migration system (Supabase CLI migrations or numbered SQL + `schema_migrations`); single source of truth feeding `initdb.d` | PRA §3.2, CRR §4.3 | 2.5 |
| ☐ | P2.4 | SIGTERM graceful shutdown: drain in-flight requests, close Supabase client, `STOPSIGNAL SIGTERM`, `stop_grace_period` | PRA §5.6 | 0.5 |
| ☐ | P2.5 | Move session state (tenant/officer/demo) server-side (Supabase `sessions` or Redis) with session-id cookie + expiry | PRA §3.3 | 2 |
| ☐ | P2.6 | Evidence storage: retention policy, bucket versioning, consider WORM for audit evidence | PRA §3.4 | 1 |

**Dependencies:** P0 (CI to validate migrations); benefits from P1 (route tests
cover the session refactor).
**Exit criterion:** A documented, *tested* restore brings back all officer
captures; schema changes go through versioned migrations; a rolling deploy
drops zero in-flight requests; officer sessions survive a browser restart.

---

## 6. Phase P3 — Observability & Security headers

**Objective:** Operators can see what the system is doing and are alerted when
it breaks; the app meets baseline web-security header expectations; admin
actions are audited.

| S | # | Task | Source | Effort |
|---|---|------|--------|--------|
| ☐ | P3.1 | Structured logging (pino/winston, JSON); replace `console.*`; add request-duration logging in middleware | PRA §2.2, CRR §2.5 | 2 |
| ☐ | P3.2 | Error tracking (Sentry — official Next.js SDK) | PRA §2.2 | 1 |
| ☐ | P3.3 | Metrics/APM: request rate, latency p50/p95/p99, error rate by endpoint, memory/CPU (CloudWatch/Datadog or `/metrics`) | PRA §2.2 | 2 |
| ☐ | P3.4 | CSP + HSTS + security headers via `next.config.ts`; set `secure: true` cookies behind HTTPS | PRA §4.4, §4.5 | 0.5 |
| ☐ | P3.5 | Explicit CORS config (whitelist origins) | PRA §4.3 | 0.5 |
| ☐ | P3.6 | Admin audit logging on all `/api/admin/*` (who/when/where); document `SEED_ADMIN_TOKEN` rotation; move admin token out of query string | PRA §4.6, CRR §1.5 | 1 |
| ☐ | P3.7 | Consistent API error response shape (fold into shared helpers) | CRR §2.4 | 0.5 |

**Dependencies:** P0 (CI); P3.1 best done before P3.2/P3.3 so logs feed them.
**Exit criterion:** No raw `console.*` in request paths; errors surface in
Sentry; a dashboard shows latency/error rate; security-header scan passes;
every admin call is audited with no token in the URL.

---

## 6a. Phase PR3 — The three missing pillars (Tier N3)

**Objective:** Build Governance, Strategy, and Risk-management disclosure plus
Targets and cross-industry metrics — the three of four S2 pillars the platform
occupies none of today. These are structured narrative capture with evidence
attachment (closer to the ESDD wizard than the PCAF engine), except N3.8
scenario analysis, which is the largest single build in the whole programme and
the commercial pivot to the Additional Risk Modules catalogue.

| S | # | Task | Standard | Demo | Live | Effort |
|---|---|------|----------|------|------|--------|
| ☐ | N3.1 | **Governance capture** — oversight body, responsibilities, skills, how/how-often informed, trade-offs, whether climate metrics enter remuneration. | S2 §6 | seeded sample | bank capture | 4 |
| ☐ | N3.2 | **Risk-management process capture** — identification, assessment, prioritisation, monitoring; scenario-analysis input; integration into overall risk management. Reference existing Annex 5/5b/CAP/NGFS rather than re-enter. | S2 §25 | seeded sample | bank capture | 4 |
| ☐ | N3.3 | **Strategy capture** — physical/transition classification, time horizons, business-model + value-chain concentration. | S2 §10, §13 | seeded sample | bank capture | 4 |
| ☐ | N3.4 | **Transition-plan capture** (only where the bank has one; no obligation to have one). | S2 §14(a)(iv) | seeded sample | bank capture | 2 |
| ☐ | N3.5 | **Targets** — metric, objective, scope, period, base period, milestones, absolute vs intensity, gases/scopes, gross vs net, carbon-credit use + verifying scheme. | S2 §§33–36 | seeded sample | bank capture | 5 |
| ☐ | N3.6 | **Cross-industry metrics** §29(b)–(d): assets vulnerable to transition risk, physical risk, and aligned with opportunities. Existing Green/Amber/Red are NRB-taxonomy and must **not** be relabelled §29(d) without a mapping. | S2 §29(b)–(d) | shared | shared | 4 |
| ☐ | N3.7 | **Capital deployment, internal carbon price, remuneration** — three small captured metrics. | S2 §29(e)–(g) | seeded | bank capture | 2 |
| ☐ | N3.8 | **Scenario analysis + climate resilience.** §22 mandates it; B17 requires a quantitative approach where exposure is material and resources exist. Same engine as the Additional Risk Modules catalogue — scope once, serve both. Also serves NRB Chapter VIII §8.4. **The largest single build.** | S2 §22, B1–B18 | shared | shared | 20+ |

**Dependencies:** PR0, P1. **N3.8 must not start before PR1 (B62) is complete** —
it depends on the portfolio data quality PR1 establishes.
**Exit criterion:** Governance/Strategy/Risk-management render as disclosure;
targets + cross-industry metrics are captured and disclosed; scenario analysis
produces a quantitative resilience assessment. Effort ≈ **45 days** (25 for
N3.1–N3.7 + 20+ for N3.8; backlog §8).

---

## 7. Phase P4 — Scale, resilience & maintainability

**Objective:** The system tolerates load, instance loss, and upstream outages;
the worst component is decomposed; end-to-end journeys are guarded.

> **Note on P4.8 ↔ N0.1:** P4.8 says "fold AGGREGATOR-PAIR duplication" — that
> duplication is removed earlier by **N0.1** (PR0). By the time P4.8 runs, P4.8
> is only the `esrm-tab.tsx` decomposition; the aggregator fold is already done.

| S | # | Task | Source | Effort |
|---|---|------|--------|--------|
| ☐ | P4.1 | Real-data path: point the app at Supabase/Postgres populated by a real ingestion pipeline; retire the in-memory portfolio for live tenants (provider pattern already supports this) | PRA §1.1, CRR §4.1 | 3 |
| ☐ | P4.2 | DB-level pagination (LIMIT/OFFSET or keyset) for live portfolio; the `queryLoans()` signature already supports it | PRA §1.3 | 1 |
| ☐ | P4.3 | Horizontal scaling: ≥2 replicas behind a load balancer; audit module-level caches (`facilityCache`, `nplLocationCache`) for per-instance safety or move to Redis | PRA §1.2, CRR §2.3 | 3 |
| ☐ | P4.4 | Move PDF/Excel generation off the request path (background worker) | PRA §1.2 | 2 |
| ☐ | P4.5 | CDN for static assets + tour audio (CloudFront/Vercel Edge/Cloudflare) | PRA §1.4 | 1 |
| ☐ | P4.6 | Supabase client reconnection (health check `SELECT 1`, recreate on failure) | PRA §2.4 | 0.5 |
| ☐ | P4.7 | Circuit breaker / confirm all external data is pre-ingested per data-sourcing policy | PRA §2.6 | 1 |
| ☐ | P4.8 | Decompose `esrm-tab.tsx` (~3,100 LOC) into 4–5 sub-components; fold AGGREGATOR-PAIR duplication | CRR §2.1, §2.2 | 3 |
| ☐ | P4.9 | Tier 3 component tests (wizards) + Tier 3 coverage; tighten non-null assertions / loose coercion | TS §4.3, CRR §5.1, §5.2 | 4 |
| ☐ | P4.10 | Playwright config + the 6 critical E2E journeys (incl. exit-demo regression) | TS §5.3 | 2.5 |

**Dependencies:** P1 (route tests de-risk the P4.1 data-path swap and P4.8
decomposition); P0 (CI runs E2E).
**Exit criterion:** App runs multi-replica with a real-data tenant; static
assets served from CDN; `esrm-tab` decomposed and tested; 6 E2E journeys green
in CI; upstream outage degrades gracefully, not fatally.

---

## 7a. Phase PR4 — Presentation mechanics (Tier N4)

**Objective:** The general presentation requirements of S1 that wrap every
disclosed number — comparatives with restatement, materiality judgements,
connected information, measurement uncertainty, and first-year transition
reliefs. These are properties of the *reporting period and its presentation*,
not of the regulatory arithmetic, so they layer on top of PR1–PR3 rather than
changing any computed value.

| S | # | Task | Standard | Demo | Live | Effort |
|---|---|------|----------|------|------|--------|
| ☐ | N4.1 | **Comparatives** for all disclosed amounts, with a restatement mechanism and an "as previously reported" record. Neither export currently has a prior-period column. | S1 §70, B49–B53 | shared | shared | 4 |
| ☐ | N4.2 | **Materiality judgements** capture and disclosure. | S1 §74, B19–B29 | seeded | bank capture | 2 |
| ☐ | N4.3 | **Connected information** — link disclosed figures to financial statement line items. | S1 §21, B39–B44 | shared | shared | 3 |
| ☐ | N4.4 | **Measurement uncertainty** disclosure — amounts subject to high uncertainty, sources, assumptions. | S1 §§77–81 | shared | shared | 2 |
| ☐ | N4.5 | **Transition-relief flags** — first-year reliefs under S1 E3–E6 and S2 C3–C5 are a configured, disclosed property of the reporting period, not a code assumption. A bank omitting financed emissions in year one under C4(b) must be able to say so. | S1 E3–E6, S2 C3–C5 | shared | shared | 2 |

**Dependencies:** PR1 (there must be disclosed amounts to attach comparatives,
uncertainty, and connected-information to). N4.5 also feeds ND.10's sales
timeline guidance.
**Exit criterion:** Every disclosed amount carries a prior-period comparative
with a restatement path; materiality judgements, connected information, and
measurement uncertainty are disclosed; transition reliefs are a configured,
visible property of the reporting period. Effort ≈ **13 days** (backlog §9).

---

## 8. Phase P5 — Go-live

**Objective:** Ship to a real bank with a tested rollback path, a staging
environment that mirrors production, and runbooks the on-call can follow.

| S | # | Task | Source | Effort |
|---|---|------|--------|--------|
| ☐ | P5.1 | Staging environment mirroring prod (same DB engine, auth flow, data volume) | PRA §5.4 | 1.5 |
| ☐ | P5.2 | CD pipeline: build → tag image with git SHA → push to registry → deploy; keep last 5 images | PRA §5.2, §5.3 | 1 |
| ☐ | P5.3 | Rollback procedure: documented + drilled (pull previous SHA, restart) / Vercel instant rollback | PRA §5.3 | 0.5 |
| ☐ | P5.4 | Secrets management: source prod secrets from AWS SSM / Vercel env; startup validation of required env vars | PRA §5.5 | 1 |
| ☐ | P5.5 | Runbooks: incident response, backup/restore, deploy, rollback, on-call | PRA §3.1, §5.3 | 1 |
| ☐ | P5.6 | Pilot with one bank on real data; monitor; iterate | — | 1 |

**Dependencies:** all prior phases.
**Exit criterion:** A deploy can be rolled back in minutes and the procedure has
been rehearsed; staging matches prod; a pilot bank is live on real data with
backups, monitoring, and alerting confirmed working.

---

## 8a. Phase PRD — Regulatory documentation & accuracy (Tier ND)

**Objective:** Bring the sales material, product claims, research notes, source
pack, and user manual into line with what the platform actually delivers, and
lock the demo/live computation boundary into `ARCHITECTURE.md` so the integrity
work of PR0 cannot silently regress. This tier is prose and provenance, not
code — **it is not sequenced after P5**; it runs in the background alongside the
PR/P phases (placed here only to keep the numbered code-phases contiguous), with
the noted hard dependencies.

| S | # | Task | Rationale | Effort |
|---|---|------|-----------|--------|
| ☐ | ND.1 | **Retire "the platform delivers NFRS S1/S2 disclosure"** across all sales and product material. It delivers part of one paragraph of S2 plus the evidence trail. Gap analysis §9 has the replacement claims. | Accuracy | 0.5 |
| ☑ | ND.2 | **IFRS S2 vintage — verified 19 Sep 2026.** The NFRS drafts track the original **June 2023** text. The ISSB amendments were issued **11 December 2025** and are effective 1 Jan 2027. ASB Nepal drafted on the unamended text. **GICS and latest-IPCC GWPs are both mandatory for us**; no relief available. Written up as gap analysis §7.1. | Unblocked N1.7 | 0.5 |
| ☐ | ND.3 | **Stop presenting PCAF as what the standard requires.** Neither standard mentions PCAF; B62(d) asks only that the allocation method be disclosed. Adjust the brochures and the user manual. | Accuracy | 0.5 |
| ☐ | ND.4 | **Correct the research note** `research/03-nfrs-s1-s2-requirements.md`: B40 characteristics are "listed in no particular order" not a ranked ladder; §22(b)(i)(4) is disclose-whether not use-one; the E4 nine-month backstop does not apply to E4(a); the scope over-read in §1.2. | Feeds our own reasoning | 1 |
| ☐ | ND.5 | **Add NRB Risk Management Guidelines 2026 to the regulatory source pack** (`docs/regulatory-sources/`, new `11-nrb-risk-management/`) via `download.sh`, and add Chapter VIII to `HOW_THE_DEMO_USES_THESE.md`. | Primary source missing | 0.5 |
| ☐ | ND.6 | **Add a Chapter VIII section to the gap analysis** — the regulatory picture changed after it was written. | Currency | 1 |
| ☐ | ND.7 | **Document the demo/live computation boundary** in `ARCHITECTURE.md` — the §0 "one computation, two providers" principle, plus what the guard scripts enforce. | Prevents recurrence | 1 |
| ☐ | ND.8 | **User manual v0.4** once N0 and N1 land: the disclosure surface will have changed materially. Rebuild figures via `npm run capture:manual`. | Manual accuracy | 2 |
| ☐ | ND.9 | **Residual "Circular 22" citations in code comments** — roughly a dozen files. Some are legitimate Excel cell references; several are operative citations. | Consistency with P46 | 1 |
| ☐ | ND.10 | **Timeline guidance for sales** — one page: no NFRS effective date, C4(b) defers financed emissions to year two, Chapter VIII is supervisory expectation with soft modals. Prevents the urgency overclaim. | Sales accuracy | 0.5 |
| ☐ | ND.11 | **Route the vintage point to ASB Nepal** via NRB, ICAN or IFC. The comment window closed 6 June 2026 but the standards are not final, and IFC is already running the consultation and ToT programme with ASB. The two provisions the ISSB relaxed (GICS, IPCC GWPs) are the two that bite hardest on a Nepali commercial bank. | Regulatory influence | 0.5 |

**Dependencies:** ND.7 depends on PR0 (there is a boundary to document once the
demo hash and provider split are cleaned up); ND.8 depends on PR0 + PR1 (the
manual can only be rebuilt once the disclosure surface stabilises). ND.1, ND.3,
ND.4, ND.5, ND.10 have no code dependency and can start immediately. ND.2 is
**done** (☑, vintage verified 19 Sep 2026).
**Exit criterion:** No product or sales claim overstates the disclosure
coverage; the research notes and source pack are correct and current; the
demo/live boundary is documented in `ARCHITECTURE.md`; the user manual reflects
the post-PR1 surface. Effort ≈ **8.5 days** remaining (ND.2 already banked;
backlog §9).

---

## 9. Dependency graph (critical path)

```
P0 (CI + harness)
 └─> PR0 (regulatory integrity — provider-independent core)   ← NEW top-priority correctness gate
       └─> P1 (regulatory 100% + route tests)   ← locks the corrected core to 100%
             ├─> P2 (durability: backups, migrations, sessions)
             ├─> P3 (observability + security headers)   [parallel to P2]
             ├─> PR1 (B62 compliance)
             │     └─> PR2 (the bank's own footprint)
             │           └─> PR3 (three missing pillars; N3.8 scenario analysis)
             │                 └─> PR4 (presentation mechanics: comparatives, materiality…)
             └─> P4 (scale, resilience, decomposition, E2E)
                   └─> P5 (staging, rollback, pilot, go-live)

PRD (docs & accuracy) runs in the background alongside all phases:
  ND.1/ND.3/ND.4/ND.5/ND.10 start immediately; ND.7 after PR0; ND.8 after PR1.
```

**Sequencing rationale.** PR0 is inserted **between P0 and P1**: the disclosed
number depends on the code path (name-substring PCAF scoring, chart-tuned retail
factor, demo hash living in `lib/regulatory`), so the core must be made
provider-independent **before** P1 locks its behaviour to 100% — otherwise P1
would freeze the bugs. PR1→PR2→PR3→PR4 is a strict chain: B62 portfolio quality
must exist before the bank's own footprint, both before the three pillars, and
disclosed amounts must exist before comparatives/materiality wrap them (N3.8
scenario analysis explicitly must not start before PR1 is complete). P2/P3 and
the PR chain run in parallel once P1 is done; P4's data-path swap (P4.1) and
`esrm-tab` decomposition (P4.8 — the aggregator fold is already done by N0.1)
still depend on P1's tests to be safe. P5 gates on everything.

---

## 10. Risk register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Tests surface existing regulatory bugs | **High** | High (good — that's the point) | P1.7 buffer; treat each as a finding, trace to the regulation, fix with a test |
| P1 freezes an integrity bug (locks a wrong number to 100%) | **High** if P1 precedes PR0 | Critical | Sequence PR0 **before** P1 (dependency graph §9); PR0 makes the core provider-independent first, so P1 locks the corrected behaviour |
| Disclosed number depends on code path, not data | **Present today** | Critical | PR0/N0.1–N0.10: remove name-substring PCAF scoring, chart-tuned retail factor, demo hash in `lib/regulatory`; enforce "one computation, two providers" |
| In-memory → DB swap changes numbers subtly | Medium | High | P1 route/regulatory tests as the golden reference before P4.1 |
| Supabase restore untested until needed | Medium | Critical | P2.2 explicitly tests restore to a clean instance |
| `esrm-tab` decomposition introduces UI regressions | Medium | Medium | Do P4.9/P4.10 (component + E2E tests) alongside, not after |
| Scope creep delays correctness work | Medium | High | P0+P1 are fixed, front-loaded, and gated; later phases flex |
| Single-instance caches break under multi-replica | Medium | Medium | P4.3 cache audit before enabling ≥2 replicas |

---

## 11. Milestones (suggested gates for review)

| Milestone | Phases | Meaning |
|-----------|--------|---------|
| **M1 — Guarded** | P0 | Nothing merges without passing CI. |
| **M2 — Integrity** | PR0 | The regulatory core is provider-independent: no name-substring scoring, no chart-tuned factors, no demo hash in `lib/regulatory`. The disclosed number depends on the data, not the code path. **This is the true gate before any real bank data touches the system** — it must precede M3. |
| **M3 — Provably correct** | P1 | The corrected regulatory core is 100% tested; routes verified. Freezes the *right* behaviour, because PR0 ran first. |
| **M4 — B62 compliant** | PR1, PR2 | Financed-emissions disclosure meets IFRS/NFRS S2 B62; the bank's own Scope 1/2 footprint is disclosed. |
| **M5 — Full disclosure surface** | PR3, PR4 | Governance/Strategy/Risk-management, Targets, cross-industry metrics, and scenario analysis render; comparatives, materiality, connected information, and measurement uncertainty wrap every amount. |
| **M6 — Durable** | P2, P3 | Data recoverable, changes versioned, system observable and defended. |
| **M7 — Resilient** | P4 | Scales, degrades gracefully, maintainable, E2E-guarded. |
| **M8 — Live** | P5 | Pilot bank in production with rollback rehearsed. |

> **PRD (docs & accuracy)** is not a numbered milestone — it runs continuously
> alongside M2–M8. ND.1/ND.3/ND.4 (retiring the overclaim) should land before
> any sales conversation that cites disclosure coverage; ND.7 (the demo/live
> boundary in `ARCHITECTURE.md`) closes with M2; ND.8 (user manual v0.4) closes
> with M3/M4.

---

## 12. Relationship to the source documents

This plan supersedes the ad-hoc roadmap tables in
`PRODUCTION_READINESS_ASSESSMENT.md` §Remediation Roadmap and the "Remaining
Phase 1/2" lists in `CLAUDE.md` — those remain accurate as **source detail**,
but this document is the single **sequenced, status-bearing** view. The
mechanics of keeping it current (who updates it, when, and how) are defined in
the **Maintenance protocol** in §0 — read that before editing. In short: the PR
that ships a task flips its `S` glyph and adds a Changelog line (§13) in the
same PR.

---

## 13. Changelog

Newest first. Each line records a status change or scope edit, the task ID(s)
affected, and the merge commit/PR that carried it. Per §0 rule 1, a task is not
"done" until it appears here as ☑.

| Date | Change | Task(s) | Commit / PR |
|------|--------|---------|-------------|
| 2026-09-20 | **PR0-a — regulatory-integrity safe slice + P0.6 (N0.8/N0.9/N0.10/P0.6 → ☑).** Arithmetic-neutral by design; all 24 goldens pass with **zero KPI movement** in `node:20-alpine`. **N0.8**: `bankClassForTenant()` no longer returns `"A"` unconditionally — added a `BankClass` type + `bankClass` field to `TenantConfig` (`lib/tenants/types.ts`), set it per tenant in the registry, and the function now reads it (`buildGreenStatementReport` widened to `Pick<…,"id"|"branding"|"bankClass">`); both demo tenants are Class A so no figure moves. **N0.9**: corrected the NFRS-tab methodology citation — dropped the fabricated "NFRS draft §17(b)", re-pointed financed emissions to IFRS S2 Appendix B (B58–B63; B62(d) allocation-method disclosure), framed PCAF as the *chosen* method not a mandate. **N0.10**: added `scripts/check-regulatory-boundary.mjs` (8th `prebuild` guard, run by CI) — fails on any *new* policy constant/duplicated aggregator outside `lib/regulatory`, grandfathers the four known N0.1/N0.5/N0.6/N0.7 occurrences (warn-only) so PR0-b/c tighten the net as each relocates. **P0.6**: `npm audit --audit-level=high` CI step (the two pre-existing transitive `uuid`←`exceljs` moderates do not block; their only fix is a breaking `exceljs@3.x` downgrade), and pinned all top-level deps to exact versions matching the lockfile (regenerated via `--package-lock-only`; `npm ci` re-verified). | N0.8, N0.9, N0.10, P0.6 | _this PR_ |
| 2026-09-19 | **Test harness + PR0 baseline goldens (P0.2–P0.4 done → ☑).** Added Vitest (`vitest.config.mts` — `.mts` so the ESM config loads without making the CJS root `type:module`; `@/`→root alias mirroring tsconfig; `node` env default with per-file jsdom opt-in; v8 coverage **report-only**, no gate until P1.5; `hookTimeout` 60s for the ~15s synthesizer) + `@vitest/coverage-v8`, `@testing-library/react`+`dom`, `msw`, `jsdom`, `@vitejs/plugin-react`. Added `test`/`test:unit`/`test:watch`/`test:coverage` scripts and a `Test (report-only coverage)` step to the CI `checks` job. `tests/vitest-globals.d.ts` supplies the Vitest globals to `tsc` without an explicit `types` array (which would break the app's ambient types). Wrote the PR0 characterization goldens under `tests/golden/` pinning today's disclosed figures (**80,035 loans → 9,774,371 tCO₂e**, DQ 3.8, taxonomy/funnel/sector/trend, demo↔live aggregator equivalence, PCAF score histogram, 70,000-loan retail-pool = 2,044,419 tCO₂e) so every N0 edit is a reviewed diff. A `tests/global-setup.ts` runs the existing `precompute-portfolio` step ONCE before any worker (writing the gz `getPortfolio()` prefers), so the three goldens gunzip (~300ms each) instead of re-synthesizing — without it, Vitest's per-file worker isolation re-ran the ~50-80s synthesis per file and every `beforeAll` timed out on the (slower) GitHub Actions runner. Whole suite now ~21s. 24/24 tests green in `node:20-alpine`; deterministic across runs. PR0 code deferred to a follow-up PR. Boy-scout: P1.5's stale `vitest.config.ts` → `.mts`. | P0.2, P0.3, P0.4; PR0 baseline | 02e1a84 + f26825c (PR #52 → dev, #53 → main) |
| 2026-09-19 | **NFRS remediation backlog integrated as PR-phases.** Scheduled the six tiers of `docs/NFRS_REMEDIATION_BACKLOG.md` into this plan as new **Production-Regulatory** phases: PR0 Regulatory integrity (§3a, N0.1–N0.10), PR1 B62 compliance (§4a, N1.1–N1.12), PR2 the bank's own footprint (§4b, N2.1–N2.6), PR3 three missing pillars (§6a, N3.1–N3.8), PR4 presentation mechanics (§7a, N4.1–N4.5), PRD documentation & accuracy (§8a, ND.1–ND.11; ND.2 already ☑). Updated the phase overview (§2), dependency graph (§9 — PR0 sits **between P0 and P1** so P1 cannot freeze integrity bugs), risk register (§10 — added the "P1 freezes an integrity bug" and "number depends on code path" risks), and milestones (§11 — renumbered to M1–M8 with M2 Integrity as the true gate before real bank data). Backlog file updated with the tier→phase cross-reference table; it remains the per-task detail source, PROJECT_PLAN carries status. Documentation-only; no regulatory code touched. | PR0–PR4, PRD | fe572fe (PR #50 → dev, #51 → main) |
| 2026-09-19 | Boy-scout fix: baseline §1 corrected "10 build guard scripts" → **8** (matches the actual `prebuild` chain: check-dockerignore-build-scripts, check-build-wiring, check-demo-imports, check-demo-mode-gate, check-docker-demo-flag, check-capture-client, check-demo-officers, precompute-guard). | — | fe572fe (PR #50 → dev, #51 → main) |
| 2026-09-19 | P0.1 done → ☑. Added Docker-based `ci.yml` (node:20-alpine checks job + real demo/live image build), `.nvmrc`, `eslint.config.mjs` (flat config; `next lint` was interactive/unusable in CI), and `type-check` script. Turned the lint gate on: fixed all 18 lint errors, removed 28 dead-code warnings (unused imports/vars + unused eslint-disable directives). Downgraded 2 experimental react-hooks RC rules to `warn` and deferred 8 exhaustive-deps + 2 no-img + 1 no-location warnings to P1 (documented in eslint.config.mjs) — fixing effects/images without a test net is unsafe. Provenance guard deliberately excluded from CI (needs live Supabase secrets; requires Node ≥ 22). | P0.1 | f35c4ea (PR #48 → dev, #49 → main) |
| 2026-09-09 | Plan created; all tasks ☐ (not started). Added maintenance protocol (§0), status column, and this changelog. | P0–P5 | _this PR_ |
