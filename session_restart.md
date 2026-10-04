# Session Restart - 2026-09-26

## Working Branch
`feature/20260923_1`

## Last Commits
- `825e446` docs(P1.7): session handoff after Categories 1+2 complete
- `aa7e0f3` test(P1.7): Fix Category 2 - correct test HTTP method imports
- `d5d0ba6` test(P1.7): Fix Category 1 - add missing auth checks to 10 routes
- `3adac7e` test(P1.7): fix DEMO_MODE_COOKIE mock + add GET /api/demo/mode

## Current State: P1.7 Bug Fixing (In Progress)

**Test Status**: 28 failed / 43 passed (71 total) — **15 bugs fixed**

### Completed ✅

1. **Category 1 (10 bugs)** - Missing auth checks
   - Added `requireOfficer()` to 10 GET routes
   - Commit: `d5d0ba6`

2. **Category 2 (3 bugs)** - Test import errors
   - Fixed test HTTP method imports (GET→DELETE, GET→POST, POST→PATCH)
   - Commit: `aa7e0f3`

### Remaining Work (28 bugs)

See `P1.7_BUG_TRACKING.md` for full categorization. Quick summary:

**Category 3: Dynamic route 404s (7 bugs)**
Routes checking params before auth, returning 404 instead of 401:
- `GET /api/pcaf/availability/[borrowerId]`
- `POST /api/pcaf/availability/[borrowerId]`
- `GET /api/pcaf/evidence/[loanId]`
- `POST /api/loans/[loanId]/claim`
- `GET /api/cap/[loanId]`
- `POST /api/cap/[loanId]`
- `GET /api/climate/borrower/[borrowerId]`

**Fix**: Move `requireOfficer()` before param validation.

**Category 4: MSW handlers (15 bugs)**
Happy-path tests failing because Supabase mock returns empty results. Need per-test `server.use()` overrides:
- `POST /api/esdd/responses` (4 tests)
- `GET /api/esdd/responses` (1 test)
- `POST /api/taxonomy/assessments` (1 test)
- `GET /api/pcaf/scores` (1 test)
- `GET /api/cap/[loanId]` (1 test)
- `POST /api/cap/[loanId]` (1 test)
- `POST /api/officer/set` (1 test)
- Others TBD

**Fix**: Add MSW `server.use(http.post(...))` overrides in test cases.

**Category 5: Miscellaneous (5 bugs)**
- `GET /api/settings` - missing "demo" property
- `POST /api/tenant/set-code` - 2 tests failing with default tenant
- `POST /api/tenant/clear` - cookie clearing issue
- `POST /api/auth/device-token` - malformed JSON returns 500 instead of 400
- `POST /api/officer/set` - case sensitivity: `SameSite=Strict` vs `SameSite=strict`

**Fix**: Individual route logic fixes.

## Test Execution

All tests run in Docker (node:20-alpine):

```bash
# Run all route tests
docker run --rm -v "/Users/willardmechem/Projects/repos/jana-bfi-demo:/app" -w /app node:20-alpine sh -c "npm ci --quiet && npm run test:unit tests/routes/"

# Run specific test file
docker run --rm -v "/Users/willardmechem/Projects/repos/jana-bfi-demo:/app" -w /app node:20-alpine sh -c "npm ci --quiet && npm run test:unit tests/routes/FILENAME.route.test.ts"
```

## Key Files

- **Tracking**: `P1.7_BUG_TRACKING.md` (updated with progress)
- **Test infrastructure**: `tests/setup.ts`, `tests/helpers/msw-setup.ts`, `tests/helpers/route-test-utils.ts`
- **Route tests**: `tests/routes/*.route.test.ts` (13 files, 71 tests)
- **Routes fixed**: 10 routes in `app/api/**/route.ts` now have auth checks

## Context for Next Session

The test infrastructure is solid (4-layer mock stack works correctly). The remaining 28 bugs are straightforward route-level fixes:

1. **Category 3** (~30 min): Auth-before-params pattern (7 routes)
2. **Category 4** (~90 min): MSW overrides for Supabase INSERT/SELECT responses (15 tests)
3. **Category 5** (~30 min): Misc fixes (5 bugs)

Estimated completion: 2-3 hours.

## Next Action

Pick up with Category 3: read the 7 dynamic routes, move auth checks before param validation, test, commit.
