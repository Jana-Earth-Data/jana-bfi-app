# Code Review Report — jana-bfi-demo

**Date:** 2026-08-25
**Scope:** Full codebase audit — all API routes (40), components (~30), library modules (~50), configuration, Docker, and build tooling.
**Branch:** `feature/20260824_1`

---

## Executive Summary

The codebase is well-engineered for its purpose (a sales-demo dashboard for financed-emissions assessment). Architectural discipline is strong — particularly the build-time demo/live boundary enforcement and multi-tenant data isolation. No critical security vulnerabilities were found. The primary concerns are around code duplication, component size, test coverage, and patterns that would need attention before evolving this from a demo into a production application.

**Severity legend:** CRITICAL = must fix before any production use. HIGH = should fix soon. MEDIUM = address during next refactor. LOW = cosmetic or minor improvement.

---

## 1. Security Concerns

### 1.1 No Rate Limiting on Any Endpoint — HIGH

**Location:** All 40 API routes under `app/api/`

No rate limiting exists at the application layer. Admin endpoints (`/api/admin/seed`, `/api/admin/reset`) are protected by a shared token but accept unlimited requests per second. Data mutation endpoints (evidence upload, ESDD responses, PF screening submissions) have no throttling.

**Impact:** An attacker who obtains or guesses the admin token could repeatedly trigger seed/reset operations. Evidence upload endpoints could be used for storage exhaustion.

**Recommended fix:**
- Add per-IP or per-tenant rate limiting in `middleware.ts` for mutation endpoints.
- Add stricter rate limits (e.g., 5 req/min) on `/api/admin/*` routes.
- Consider Next.js middleware-based rate limiting or an upstream WAF rule.

### 1.2 Request Body Size Not Bounded — MEDIUM

**Location:** All `POST` routes that call `request.json()`

Next.js does not enforce a default request body size limit on API routes. While evidence upload checks file size (10 MB cap at `app/api/evidence/route.ts`), JSON body endpoints (`/api/esdd/responses`, `/api/pf-screening/submit`, `/api/taxonomy/assessments`, etc.) accept arbitrarily large JSON payloads.

**Impact:** Memory exhaustion via oversized JSON payloads.

**Recommended fix:**
- Configure `bodyParser.sizeLimit` in `next.config.ts` or add explicit size checks in routes.
- Example: `export const config = { api: { bodyParser: { sizeLimit: '256kb' } } };`

### 1.3 MIME Type Not Validated on Evidence Upload — LOW

**Location:** `app/api/evidence/route.ts`

Evidence file uploads validate size (10 MB) but not MIME type. The file is stored as-is in Supabase storage. While the download endpoint validates `%PDF-` magic bytes for PDF responses, arbitrary file types can be uploaded and stored.

**Recommended fix:**
- Add a MIME type allowlist (e.g., `application/pdf`, `image/png`, `image/jpeg`).
- Validate magic bytes on upload, not just download.

### 1.4 Hardcoded JWT Secret in Offline Compose — LOW (by design)

**Location:** `docker-compose.offline.yml:74`

```yaml
PGRST_JWT_SECRET: "bfi-demo-offline-postgrest-jwt-secret-do-not-use-in-prod-32ch"
```

The JWT secret and derived tokens (anon, service_role) are hardcoded in the offline docker-compose file. This is explicitly documented as intentional for air-gapped demos, and the file header warns against production use. Noting for completeness.

**Recommended fix:** None needed if this file is never used in production. Add a CI check that prevents this compose file from being referenced in deployment pipelines.

### 1.5 Admin Token Transmitted in Query String — MEDIUM

**Location:** `app/api/admin/seed/route.ts`, `seed-demo-data/route.ts`, `seed-officers/route.ts`

Admin endpoints authenticate via `?token=SEED_ADMIN_TOKEN` in the query string. Query strings appear in server access logs, browser history, and HTTP referer headers.

**Recommended fix:**
- Move to `Authorization: Bearer <token>` header (the reset endpoint already uses this pattern).
- This inconsistency between reset (header auth) and seed (query param auth) should be normalized.

### 1.6 Tenant Cookie Not Validated Against Registry on Every Request — LOW

**Location:** `middleware.ts:38-44`

The middleware checks for cookie *existence* but does not validate the cookie value against the tenant registry. An invalid or tampered tenant code would be accepted by middleware and only fail downstream when `resolveCurrentTenant()` is called in the route handler.

**Recommended fix:**
- Validate cookie value against the tenant registry in middleware for fail-fast behavior.
- This prevents unnecessary server-side processing for invalid tenant codes.

---

## 2. Code Smells & Bad Practices

### 2.1 Oversized Components — HIGH

Several components exceed maintainability thresholds:

| File | Lines | Concern |
|------|-------|---------|
| `components/bfi/tabs/esrm-tab.tsx` | ~3,100 | Far exceeds any reasonable component size. Multiple rendering concerns, data transformations, chart configs, and UI logic are interleaved. |
| `components/bfi/tabs/loans-tab.tsx` | ~810 | Large but more focused. Filter/sort logic mixed with rendering. |
| `components/bfi/shared/loan-table.tsx` | ~810 | Table rendering + column definitions + sort handlers in one file. |
| `components/bfi/tabs/nfrs-tab.tsx` | ~740 | Metric calculations interleaved with rendering. |
| `components/bfi/dashboard.tsx` | ~800 | Orchestrator component — size is somewhat justified but could delegate more. |
| `components/bfi/shared/evidence-attachments.tsx` | ~450 | Upload/download/delete logic + UI in one file. |
| `components/bfi/tour/tour-overlay.tsx` | ~420 | Animation + positioning + caption rendering. |
| `components/bfi/taxonomy/wizard.tsx` | ~1,100 | Multi-step wizard — step logic, state management, and rendering all in one. |

**Recommended fix:**
- Extract `esrm-tab.tsx` into at least 4-5 sub-components: climate risk matrix, facility heatmap, emissions chart, screening summary, and data transformation utilities.
- Extract column definitions and sort logic from table components into separate modules.
- Separate wizard step components from wizard orchestration logic.

### 2.2 Duplicate Aggregation Logic (AGGREGATOR-PAIR) — MEDIUM

**Location:** `lib/api/bfi.ts:recomputeSummary()` and `lib/demo/portfolio.ts:buildSummary()`

These two functions are ~90% identical in structure — both compute portfolio summary statistics (total NPR, total CO2, loan counts, taxonomy distribution). The 10% divergence relates to PCAF overlay handling in the live vs. demo paths.

The codebase comments acknowledge this duplication ("AGGREGATOR-PAIR"). The concern is that fixing a calculation bug in one requires remembering to fix it in the other.

**Recommended fix:**
- Extract shared aggregation logic into a third module (e.g., `lib/data/compute-summary.ts`) that accepts a normalized portfolio shape.
- Both `bfi.ts` and `portfolio.ts` call the shared function with their respective inputs.

### 2.3 Module-Scoped Mutable Caches Without Invalidation — MEDIUM

**Location:** Multiple modules

| Module | Cache Variable | TTL | Invalidation |
|--------|---------------|-----|-------------|
| `lib/data/supabase.ts` | `cached` | Forever | None — singleton |
| `lib/api/openaq.ts` | `nplLocationCache`, `facilityCache` | 6h, 30m | Time-based only |
| `lib/demo/impl.ts` | `portfolioCache` | Forever | None — precomputed |

Module-level `let` variables hold cached data. These survive for the lifetime of the server process. In a long-running Node.js process (Docker), stale cache data accumulates. The Supabase client singleton is particularly notable — if the connection breaks, there's no recovery path without restarting the process.

**Recommended fix:**
- Add a manual cache-clear endpoint (or at minimum, TTL expiration) for the Supabase client singleton.
- Consider using `WeakRef` or a proper LRU cache for API response caches.
- Document cache behavior for operators (e.g., "restart container to clear caches").

### 2.4 Inconsistent Error Response Shapes — LOW

**Location:** Across API routes

Error responses use different shapes:

```typescript
// Pattern A (most routes):
return NextResponse.json({ error: "message" }, { status: 400 });

// Pattern B (some routes):
return NextResponse.json({ error: "message", details: "..." }, { status: 400 });

// Pattern C (portfolio/loans):
return NextResponse.json({ rows: [], total: 0, page: 1, pageSize: 50 }, { status: 200 });
// (returns empty data on error instead of error response)
```

**Recommended fix:**
- Define a standard error response type: `{ error: string; code?: string; details?: unknown }`.
- Create a helper function (e.g., `apiError(message, status, details?)`) used by all routes.
- Never return 200 with empty data when the operation actually failed.

### 2.5 Console Logging as Primary Observability — MEDIUM

**Location:** Throughout, especially `lib/api/client.ts:104-129`, `lib/data/screening.ts`

All logging is via `console.log` / `console.warn` / `console.error`. There is no structured logging, no log levels, no correlation IDs, and no log aggregation integration.

**Impact:** In production, debugging issues requires grepping raw stdout. There's no way to trace a request across multiple log lines without manual correlation.

**Recommended fix:**
- Introduce a lightweight structured logger (e.g., `pino`) with JSON output.
- Add request IDs to all log lines.
- Set log levels (debug, info, warn, error) to control verbosity per environment.

### 2.6 Hardcoded Magic Numbers — LOW

**Location:** Various

| Value | File | Purpose |
|-------|------|---------|
| `80035` | `lib/demo/portfolio.ts` | Portfolio scale (loan count) |
| `6e-6` | `lib/demo/portfolio.ts` | Retail tCO2e per NPR factor |
| `20` | `lib/api/client.ts:95` | Max pagination pages |
| `50` | `lib/data/portfolio-query.ts:99` | Default page size |
| `10 * 1024 * 1024` | `app/api/evidence/route.ts` | 10 MB file size limit |
| `1990`, `2100` | `app/api/pcaf/scores/route.ts` | Reporting year bounds |

These are all documented with comments, which mitigates the concern. However, they're scattered across files rather than centralized.

**Recommended fix:**
- Centralize configurable constants in a `lib/constants.ts` or `lib/config.ts` module.
- Use named exports (e.g., `MAX_FILE_SIZE_BYTES`, `DEFAULT_PAGE_SIZE`) for clarity.

---

## 3. Duplicate Code

### 3.1 Supabase Query Patterns Repeated Across Routes — MEDIUM

**Location:** Nearly every API route

The pattern of:
1. Get Supabase admin client
2. Check if configured
3. Query with tenant scoping (`.eq("bank_id", tenant.id)`)
4. Handle error
5. Return JSON response

...is repeated verbatim in 30+ routes. Each route independently handles the "no Supabase" fallback and error wrapping.

**Recommended fix:**
- Create a `withSupabase(handler)` wrapper that resolves tenant, gets client, handles errors.
- Routes receive `(supabase, tenant, officer)` and focus on business logic only.
- Example:
  ```typescript
  export const POST = withSupabase(async (sb, tenant, officer, request) => {
    // Business logic only
  });
  ```

### 3.2 Officer Resolution Duplicated Across Routes — MEDIUM

**Location:** ~25 API routes

The pattern:
```typescript
const officer = await resolveCurrentOfficer();
if (!officer) {
  return NextResponse.json({ error: "No officer selected" }, { status: 401 });
}
```
...appears in roughly 25 routes. Some routes additionally check `officer.tenant_id === tenant.id` as a cross-tenant guard.

**Recommended fix:**
- This is another candidate for the `withSupabase` wrapper above.
- Or create a `requireOfficer()` helper that returns the officer or throws an HTTP error.

### 3.3 Tenant Resolution Pattern Duplicated — LOW

**Location:** ~35 API routes

```typescript
const tenant = await resolveCurrentTenant();
```

Nearly every route resolves the tenant. This could be injected via middleware or a wrapper.

### 3.4 PDF Magic Byte Validation Duplicated — LOW

**Location:** `app/api/reports/nrb-taxonomy/route.ts`, `app/api/reports/nrbsis-green-statement/route.ts`

Both report routes contain identical `%PDF-` header validation logic. This is a small duplication but follows the pattern of independent route implementations.

**Recommended fix:**
- Extract `validatePdfBuffer(buffer)` into a shared utility.

---

## 4. Architecture & Design Concerns

### 4.1 In-Memory Portfolio for 80K Loans — HIGH

**Location:** `lib/demo/portfolio.ts`, `lib/demo/impl.ts`

The demo loads 80,035 loans into memory from a gzipped JSON file (~2.7 MB compressed, ~20-50 MB decompressed). This data is held in a module-level cache for the lifetime of the process. Every query (filter, sort, paginate) operates on this in-memory array.

**Impact:**
- Memory: ~50-100 MB per server process for portfolio data alone.
- CPU: Filtering 80K loans on every request is O(n) with no indexing.
- Concurrency: Multiple concurrent requests all iterate the same array (no contention since JS is single-threaded, but GC pressure from intermediate allocations).

**Note:** This is intentional for the demo and works well at demo scale. It would not work for production.

**Recommended fix (for production path):**
- Migrate all queries to Supabase/Postgres with proper indexes.
- The in-memory path should remain only as a fallback for local development without a database.

### 4.2 Synchronous Gzip Decompression on Cold Start — MEDIUM

**Location:** `lib/demo/impl.ts`

The precomputed portfolio JSON is decompressed using `zlib.gunzipSync()` on the first request. This blocks the Node.js event loop for potentially several seconds with a 2.7 MB compressed file.

**Recommended fix:**
- Use `zlib.gunzip()` (async) with `await` via `util.promisify`.
- Or precompute the portfolio at build time into an uncompressed JSON that can be loaded with `require()` (tree-shaking will handle the live build exclusion).

### 4.3 No Database Migration System — MEDIUM

**Location:** `scripts/supabase-*.sql`, `docker/postgres/initdb.d/`

Database schema changes are managed via ad-hoc SQL scripts. There is no migration runner, no version tracking, and no rollback capability. The offline stack depends on `initdb.d` running on first boot; subsequent schema changes require `down -v` (data loss).

**Recommended fix:**
- Adopt a lightweight migration system (Knex, Prisma Migrate, or even numbered SQL files with a version table).
- The `check-capture-client.mjs` guard is a good stopgap but not a substitute for proper migrations.

### 4.4 No Health Check Endpoint — MEDIUM

**Location:** Not present in any API route

The application has no `/api/health` or `/healthz` endpoint. Docker compose and ECS task definitions need a way to verify the application is ready to serve traffic.

**Recommended fix:**
- Add a `/api/health` route that checks:
  - Node.js process is running (trivially true if the route responds)
  - Supabase connectivity (if configured)
  - Returns `{ status: "ok", uptime: process.uptime() }`

### 4.5 Build-Time Guards Not Integrated into CI — MEDIUM

**Location:** `package.json:8` (`prebuild` script)

The extensive prebuild guard scripts (`check-demo-imports.mjs`, `check-demo-mode-gate.mjs`, `check-docker-demo-flag.mjs`, etc.) run as part of `npm run build` but there is no evidence of a CI pipeline that runs them independently. A developer could skip `prebuild` by running `npx next build` directly.

**Recommended fix:**
- Add a `lint` or `check` CI step that runs all guard scripts independently of build.
- Consider making guards fail loudly (exit code 1) with clear error messages (they likely already do, but verify).

---

## 5. TypeScript & Code Quality

### 5.1 Non-Null Assertions — LOW

**Location:** `lib/data/portfolio-query.ts:167`

```typescript
const loans = data.loans
  .filter((l) => l.borrowerId === borrowerId)
  .map((l) => ({ loan: l, attribution: attrByLoan.get(l.id)! }));
```

The `!` non-null assertion on `attrByLoan.get(l.id)` assumes every loan has an attribution. If the data is inconsistent, this produces an undefined at runtime that TypeScript won't catch.

**Recommended fix:**
- Filter out loans without attributions: `.filter((l) => attrByLoan.has(l.id))`.
- Or use a default attribution object.

### 5.2 Loose Type Coercion in API Client — LOW

**Location:** `lib/api/client.ts:30`

```typescript
if (optsOrParams && ("token" in optsOrParams || "params" in optsOrParams || "init" in optsOrParams)) {
```

The function signature accepts `FetchOptions | Record<string, QueryValue>`. Discriminating via duck-typing (`"token" in obj`) works but is fragile — if `Record<string, QueryValue>` happens to have a `token` key, it would be misinterpreted as `FetchOptions`.

**Recommended fix:**
- Use a discriminated union or separate function overloads for clarity.

### 5.3 `eslint.config.mjs` Missing — LOW

**Location:** `.eslintrc.json` (legacy format)

ESLint 9.x uses flat config (`eslint.config.mjs`) by default. The project uses the legacy `.eslintrc.json` format, which requires the `ESLINT_USE_FLAT_CONFIG=false` env var or will emit deprecation warnings.

**Recommended fix:**
- Migrate to `eslint.config.mjs` flat config format.
- Or pin ESLint below v9 if flat config migration is not a priority.

---

## 6. Dependency Concerns

### 6.1 Wide Semver Ranges — LOW

**Location:** `package.json:20-28`

Dependencies use `^` ranges (e.g., `"next": "^15.5.18"`), which allows minor version bumps. For a demo application shown to potential customers, a reproducible build is important.

**Recommended fix:**
- Pin exact versions in `package.json` or rely on `package-lock.json` (which is present and does pin).
- Verify `package-lock.json` is committed and used in Docker builds (it is: `COPY package.json package-lock.json* ./`).

### 6.2 No Security Audit in Build Pipeline — LOW

**Location:** `package.json` (no `audit` script)

There is no `npm audit` step in the build process. Known vulnerabilities in dependencies would go undetected.

**Recommended fix:**
- Add `npm audit --production` to the CI pipeline.
- Or add a `postinstall` script that runs audit (non-blocking).

---

## 7. Testing

### 7.1 No Automated Tests — HIGH

**Location:** Entire codebase

The only test framework present is Playwright (`"playwright": "^1.62.1"` in devDependencies), used solely for screenshot capture (`scripts/capture-screenshots.ts`), not for assertions or regression testing.

There are:
- **0 unit tests** for business logic (PCAF scoring, taxonomy classification, ESDD scoring, loan category derivation)
- **0 integration tests** for API routes
- **0 component tests** for React components
- **0 end-to-end tests** with assertions

The build-time guard scripts (`check-*.mjs`) are excellent for structural invariants but do not test functional correctness.

**Impact:** Any change to scoring logic, taxonomy rules, or data transformations has no automated verification. Regressions can only be caught by manual testing.

**Recommended fix:**
- Prioritize unit tests for `lib/regulatory/` (PCAF scoring, ESDD scoring, taxonomy classification). These are pure functions with well-defined inputs and outputs — ideal for unit testing.
- Add API route integration tests using a test Supabase instance.
- Add Playwright E2E tests for critical user flows (login, dashboard load, wizard completion).

---

## 8. Documentation

### 8.1 Inline Documentation Quality — EXCELLENT

Nearly every module has thorough docstrings explaining *why* the code exists, design trade-offs, and edge cases. The `Dockerfile`, `docker-compose.offline.yml`, and `middleware.ts` have particularly good documentation. This is a strength of the codebase.

### 8.2 API Route Documentation — LOW

There is no OpenAPI/Swagger specification or API documentation. Each route's contract (request/response shapes, error codes) must be inferred from code.

**Recommended fix:**
- Generate an OpenAPI spec from route handlers, or write a manual API reference.
- For a demo, this is low priority. For production, it would be essential.

---

## Summary of Findings by Severity

| Severity | Count | Key Items |
|----------|-------|-----------|
| CRITICAL | 0 | — |
| HIGH | 3 | No rate limiting; oversized components (~3,100 line file); no automated tests |
| MEDIUM | 9 | Request body size unbounded; admin token in query string; AGGREGATOR-PAIR duplication; module-scoped caches; console-only logging; synchronous gzip; no migrations; no health check; build guards not in CI |
| LOW | 9 | MIME validation on upload; hardcoded offline JWT; tenant cookie not validated in middleware; inconsistent error shapes; magic numbers; non-null assertions; loose type coercion; legacy eslint config; wide semver ranges |

---

## Positive Observations

These aspects of the codebase deserve recognition:

1. **Build-time demo/live boundary** is architecturally excellent. The guarantee that fabricated data is *absent* from live builds (not hidden, absent) is a strong design decision enforced at multiple levels.

2. **Tenant data isolation** is consistent and correct across all 40 API routes. Every query scopes to `bank_id`.

3. **Parameterized queries throughout** — zero raw SQL, zero SQL injection risk. All database access goes through Supabase's parameterized `.eq()`, `.in()`, `.ilike()` methods.

4. **Provenance tracking** via the `origin` column (demo vs. live) with CHECK constraints is a thoughtful data integrity measure.

5. **Prebuild guard scripts** are an innovative approach to architectural constraint enforcement that catches violations at build time rather than runtime.

6. **Error handling philosophy** is consistent — fail-open with graceful degradation for infrastructure issues, fail-closed for business logic violations (auth, ownership).

7. **Documentation quality** is above average. Comments explain design trade-offs, not just what the code does.
