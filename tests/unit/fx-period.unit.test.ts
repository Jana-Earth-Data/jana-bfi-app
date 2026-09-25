/**
 * UNIT TESTS — disclosure FX rate + reporting-period boundary.
 * jana-bfi-app · P1.5 of PROJECT_PLAN.md (TEST_STRATEGY §4.1, Tier 1).
 *
 * SCOPE
 * -----
 *   • lib/regulatory/fx/rates.ts       — the dated NPR/USD disclosure rate (N0.6)
 *     + nprToUsd / usdToNpr converters.
 *   • lib/regulatory/reporting/period.ts — the single disclosure-boundary source
 *     (N0.7): trend years, latest full / partial year, derived AS_OF_DATE, and
 *     the isPartialYear / isFullyReportedYear predicates.
 *
 * WHY
 * ---
 * These two modules are the sanctioned homes N0.6 / N0.7 relocated undated /
 * duplicated disclosure primitives into. Two reporting years are only comparable
 * (IFRS/NFRS S1 §24) if the rate is dated and the period boundary is defined
 * once. P1.5 pins the numeric value (arithmetic-neutral guard against a silent
 * edit), the round-trip conversion identity, the derived as-of date, and both
 * sides of the partial-year predicate.
 */
import { describe, expect, it } from "vitest";
import {
  NPR_PER_USD,
  REPORTING_FX_RATE,
  nprToUsd,
  usdToNpr,
  type FxRate,
} from "@/lib/regulatory/fx/rates";
import {
  AS_OF_DATE,
  LATEST_FULL_YEAR,
  LATEST_YEAR,
  LATEST_YEAR_PARTIAL_THROUGH,
  TREND_YEARS,
  isFullyReportedYear,
  isPartialYear,
} from "@/lib/regulatory/reporting/period";

// ---------------------------------------------------------------------------
// fx/rates.ts — dated rate + converters.
// ---------------------------------------------------------------------------

describe("REPORTING_FX_RATE", () => {
  it("carries the FY2024 NPR/USD value, dated and sourced (N0.6)", () => {
    expect(REPORTING_FX_RATE.nprPerUsd).toBe(133.5);
    expect(REPORTING_FX_RATE.asOf).toBe("2024-07-15");
    expect(REPORTING_FX_RATE.source).toContain("Nepal Rastra Bank");
  });

  it("re-exports the bare scalar equal to the rate's nprPerUsd", () => {
    expect(NPR_PER_USD).toBe(REPORTING_FX_RATE.nprPerUsd);
  });
});

describe("nprToUsd / usdToNpr", () => {
  it("convert at the default reporting-period rate", () => {
    expect(usdToNpr(100)).toBeCloseTo(13_350, 6);
    expect(nprToUsd(13_350)).toBeCloseTo(100, 6);
  });

  it("round-trips NPR → USD → NPR at the default rate", () => {
    expect(nprToUsd(usdToNpr(1_234.56))).toBeCloseTo(1_234.56, 6);
  });

  it("honour an explicit override rate (live-tenant path)", () => {
    const custom: FxRate = { nprPerUsd: 140, asOf: "2025-07-15", source: "test" };
    expect(usdToNpr(10, custom)).toBeCloseTo(1_400, 6);
    expect(nprToUsd(1_400, custom)).toBeCloseTo(10, 6);
  });
});

// ---------------------------------------------------------------------------
// reporting/period.ts — boundary constants + predicates.
// ---------------------------------------------------------------------------

describe("reporting period boundary (N0.7)", () => {
  it("pins the trend range and latest full / partial years", () => {
    expect(TREND_YEARS).toEqual([2021, 2022, 2023, 2024, 2025]);
    expect(LATEST_FULL_YEAR).toBe(2024);
    expect(LATEST_YEAR).toBe(2025);
    expect(LATEST_YEAR_PARTIAL_THROUGH).toBe("October");
  });

  it("derives AS_OF_DATE from the latest year + partial month (2025-10-31)", () => {
    expect(AS_OF_DATE).toBe("2025-10-31");
  });
});

describe("isPartialYear / isFullyReportedYear", () => {
  it("treats the latest year (and beyond) as partial", () => {
    expect(isPartialYear(2025)).toBe(true);
    expect(isPartialYear(2026)).toBe(true);
  });

  it("treats every year before the latest as fully reported", () => {
    expect(isPartialYear(2024)).toBe(false);
    expect(isPartialYear(2021)).toBe(false);
  });

  it("isFullyReportedYear is the exact complement of isPartialYear", () => {
    for (const y of [2021, 2022, 2023, 2024, 2025, 2026]) {
      expect(isFullyReportedYear(y)).toBe(!isPartialYear(y));
    }
  });
});
