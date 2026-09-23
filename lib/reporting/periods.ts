/**
 * Reporting periods — which years the platform reports on.
 *
 * Extracted from lib/data/util.ts ahead of that file moving under lib/demo/.
 * The year range is a real product concern, not demo scaffolding:
 * lib/api/bfi.ts uses TREND_YEARS to decide which years of live Climate TRACE
 * data to fetch, and the NFRS surfaces label the partial year.
 *
 * N0.7 (PR0-b): the reporting-period boundary is a disclosure primitive (a
 * disclosed as-of date and the "most recent fully-reported year" depend on it),
 * so it no longer lives here as a set of bare constants that each UI surface
 * re-derived inline. It moved to `lib/regulatory/reporting/period.ts` where it
 * is reviewed as policy, derived from ingested coverage, and shared by both the
 * demo and the live provider. This module re-exports the constants and the
 * partial-year helpers so existing call sites (lib/api/bfi.ts, lib/demo,
 * lib/data/empty-portfolio.ts) are unchanged and the year values stay identical
 * — the move is arithmetic-neutral.
 */

export {
  TREND_YEARS,
  LATEST_FULL_YEAR,
  LATEST_YEAR,
  LATEST_YEAR_PARTIAL_THROUGH,
  AS_OF_DATE,
  isPartialYear,
  isFullyReportedYear,
} from "@/lib/regulatory/reporting/period";
