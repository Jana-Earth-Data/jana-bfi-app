/**
 * Unit tests for N1.13 — per-tenant reporting FX rate and reporting period.
 *
 * Per IFRS S1 §24, sustainability-related disclosures shall be for the same
 * reporting period as the related financial statements and use the presentation
 * currency of those statements. Per IFRS S2 §29(a)(iii), entity shall disclose
 * significant judgments including the as-of date.
 *
 * Tests verify that:
 * 1. When tenant has reportingFxRate configured, that rate is used
 * 2. When tenant.reportingFxRate is undefined, falls back to REPORTING_FX_RATE constant
 * 3. When tenant has reportingPeriod configured, those values are used
 * 4. When tenant.reportingPeriod is undefined, falls back to period constants
 * 5. Partial tenant configs are handled (some fields set, others undefined)
 * 6. Helper functions accept undefined tenant (for contexts without tenant access)
 */

import { describe, it, expect } from "vitest";
import {
  REPORTING_FX_RATE,
  reportingFxRateForTenant,
  type FxRate,
} from "@/lib/regulatory/fx/rates";
import {
  TREND_YEARS,
  LATEST_FULL_YEAR,
  LATEST_YEAR,
  LATEST_YEAR_PARTIAL_THROUGH,
  AS_OF_DATE,
  trendYearsForTenant,
  latestFullYearForTenant,
  latestYearForTenant,
  latestYearPartialThroughForTenant,
  asOfDateForTenant,
} from "@/lib/regulatory/reporting/period";
import type { ReportingPeriod } from "@/lib/tenants/types";

describe("reportingFxRateForTenant()", () => {
  it("returns tenant.reportingFxRate when configured", () => {
    const customRate: FxRate = {
      nprPerUsd: 140.25,
      asOf: "2025-12-31",
      source: "NRB reference rate, FY 2025/26 close",
    };

    const tenant = { reportingFxRate: customRate };
    const result = reportingFxRateForTenant(tenant);

    expect(result).toEqual(customRate);
    expect(result.nprPerUsd).toBe(140.25);
    expect(result.asOf).toBe("2025-12-31");
    expect(result.source).toBe("NRB reference rate, FY 2025/26 close");
  });

  it("returns REPORTING_FX_RATE constant when tenant.reportingFxRate is undefined", () => {
    const tenant = {}; // No reportingFxRate configured
    const result = reportingFxRateForTenant(tenant);

    expect(result).toEqual(REPORTING_FX_RATE);
    expect(result.nprPerUsd).toBe(133.5);
    expect(result.asOf).toBe("2024-07-15");
  });

  it("returns REPORTING_FX_RATE constant when tenant is undefined", () => {
    const result = reportingFxRateForTenant(undefined);

    expect(result).toEqual(REPORTING_FX_RATE);
    expect(result.nprPerUsd).toBe(133.5);
  });

  it("returns REPORTING_FX_RATE constant when tenant.reportingFxRate is explicitly undefined", () => {
    const tenant = { reportingFxRate: undefined };
    const result = reportingFxRateForTenant(tenant);

    expect(result).toEqual(REPORTING_FX_RATE);
  });
});

describe("trendYearsForTenant()", () => {
  it("returns tenant.reportingPeriod.trendYears when configured", () => {
    const customPeriod: ReportingPeriod = {
      trendYears: [2022, 2023, 2024, 2025, 2026],
      latestFullYear: 2025,
      latestYear: 2026,
      latestYearPartialThrough: "March",
      asOfDate: "2026-03-31",
    };

    const tenant = { reportingPeriod: customPeriod };
    const result = trendYearsForTenant(tenant);

    expect(result).toEqual([2022, 2023, 2024, 2025, 2026]);
  });

  it("returns TREND_YEARS constant when tenant.reportingPeriod is undefined", () => {
    const tenant = {}; // No reportingPeriod configured
    const result = trendYearsForTenant(tenant);

    expect(result).toEqual(TREND_YEARS);
    expect(result).toEqual([2021, 2022, 2023, 2024, 2025]);
  });

  it("returns TREND_YEARS constant when tenant is undefined", () => {
    const result = trendYearsForTenant(undefined);

    expect(result).toEqual(TREND_YEARS);
  });
});

describe("latestFullYearForTenant()", () => {
  it("returns tenant.reportingPeriod.latestFullYear when configured", () => {
    const customPeriod: ReportingPeriod = {
      trendYears: [2022, 2023, 2024, 2025],
      latestFullYear: 2025,
      latestYear: 2025,
      asOfDate: "2025-12-31",
    };

    const tenant = { reportingPeriod: customPeriod };
    const result = latestFullYearForTenant(tenant);

    expect(result).toBe(2025);
  });

  it("returns LATEST_FULL_YEAR constant when tenant.reportingPeriod is undefined", () => {
    const tenant = {};
    const result = latestFullYearForTenant(tenant);

    expect(result).toBe(LATEST_FULL_YEAR);
    expect(result).toBe(2024);
  });

  it("returns LATEST_FULL_YEAR constant when tenant is undefined", () => {
    const result = latestFullYearForTenant(undefined);

    expect(result).toBe(LATEST_FULL_YEAR);
  });
});

describe("latestYearForTenant()", () => {
  it("returns tenant.reportingPeriod.latestYear when configured", () => {
    const customPeriod: ReportingPeriod = {
      trendYears: [2021, 2022, 2023, 2024, 2025],
      latestFullYear: 2024,
      latestYear: 2025,
      latestYearPartialThrough: "June",
      asOfDate: "2025-06-30",
    };

    const tenant = { reportingPeriod: customPeriod };
    const result = latestYearForTenant(tenant);

    expect(result).toBe(2025);
  });

  it("returns LATEST_YEAR constant when tenant.reportingPeriod is undefined", () => {
    const tenant = {};
    const result = latestYearForTenant(tenant);

    expect(result).toBe(LATEST_YEAR);
    expect(result).toBe(2025);
  });

  it("returns LATEST_YEAR constant when tenant is undefined", () => {
    const result = latestYearForTenant(undefined);

    expect(result).toBe(LATEST_YEAR);
  });
});

describe("latestYearPartialThroughForTenant()", () => {
  it("returns tenant.reportingPeriod.latestYearPartialThrough when configured", () => {
    const customPeriod: ReportingPeriod = {
      trendYears: [2021, 2022, 2023, 2024, 2025],
      latestFullYear: 2024,
      latestYear: 2025,
      latestYearPartialThrough: "March",
      asOfDate: "2025-03-31",
    };

    const tenant = { reportingPeriod: customPeriod };
    const result = latestYearPartialThroughForTenant(tenant);

    expect(result).toBe("March");
  });

  it("returns LATEST_YEAR_PARTIAL_THROUGH constant when tenant.reportingPeriod is undefined", () => {
    const tenant = {};
    const result = latestYearPartialThroughForTenant(tenant);

    expect(result).toBe(LATEST_YEAR_PARTIAL_THROUGH);
    expect(result).toBe("October");
  });

  it("returns LATEST_YEAR_PARTIAL_THROUGH constant when tenant is undefined", () => {
    const result = latestYearPartialThroughForTenant(undefined);

    expect(result).toBe(LATEST_YEAR_PARTIAL_THROUGH);
  });

  it("returns undefined when tenant.reportingPeriod.latestYearPartialThrough is undefined (complete year)", () => {
    const customPeriod: ReportingPeriod = {
      trendYears: [2020, 2021, 2022, 2023, 2024],
      latestFullYear: 2024,
      latestYear: 2024,
      latestYearPartialThrough: undefined, // Complete year
      asOfDate: "2024-12-31",
    };

    const tenant = { reportingPeriod: customPeriod };
    const result = latestYearPartialThroughForTenant(tenant);

    expect(result).toBeUndefined();
  });
});

describe("asOfDateForTenant()", () => {
  it("returns tenant.reportingPeriod.asOfDate when configured", () => {
    const customPeriod: ReportingPeriod = {
      trendYears: [2021, 2022, 2023, 2024, 2025],
      latestFullYear: 2024,
      latestYear: 2025,
      latestYearPartialThrough: "September",
      asOfDate: "2025-09-30",
    };

    const tenant = { reportingPeriod: customPeriod };
    const result = asOfDateForTenant(tenant);

    expect(result).toBe("2025-09-30");
  });

  it("returns AS_OF_DATE constant when tenant.reportingPeriod is undefined", () => {
    const tenant = {};
    const result = asOfDateForTenant(tenant);

    expect(result).toBe(AS_OF_DATE);
    expect(result).toBe("2025-10-31");
  });

  it("returns AS_OF_DATE constant when tenant is undefined", () => {
    const result = asOfDateForTenant(undefined);

    expect(result).toBe(AS_OF_DATE);
  });

  it("handles as-of date for complete year (no partial-through)", () => {
    const customPeriod: ReportingPeriod = {
      trendYears: [2020, 2021, 2022, 2023, 2024],
      latestFullYear: 2024,
      latestYear: 2024,
      asOfDate: "2024-12-31",
    };

    const tenant = { reportingPeriod: customPeriod };
    const result = asOfDateForTenant(tenant);

    expect(result).toBe("2024-12-31");
  });
});

describe("Partial tenant configurations", () => {
  it("handles tenant with only reportingFxRate set (period uses defaults)", () => {
    const customRate: FxRate = {
      nprPerUsd: 138.0,
      asOf: "2025-07-15",
      source: "Custom bank rate",
    };

    const tenant = { reportingFxRate: customRate };

    expect(reportingFxRateForTenant(tenant)).toEqual(customRate);
    expect(trendYearsForTenant(tenant)).toEqual(TREND_YEARS);
    expect(asOfDateForTenant(tenant)).toBe(AS_OF_DATE);
  });

  it("handles tenant with only reportingPeriod set (FX uses default)", () => {
    const customPeriod: ReportingPeriod = {
      trendYears: [2022, 2023, 2024],
      latestFullYear: 2024,
      latestYear: 2024,
      asOfDate: "2024-12-31",
    };

    const tenant = { reportingPeriod: customPeriod };

    expect(reportingFxRateForTenant(tenant)).toEqual(REPORTING_FX_RATE);
    expect(trendYearsForTenant(tenant)).toEqual([2022, 2023, 2024]);
    expect(latestFullYearForTenant(tenant)).toBe(2024);
    expect(asOfDateForTenant(tenant)).toBe("2024-12-31");
  });

  it("handles tenant with both reportingFxRate and reportingPeriod set", () => {
    const customRate: FxRate = {
      nprPerUsd: 142.5,
      asOf: "2026-06-30",
      source: "NRB mid-year rate",
    };

    const customPeriod: ReportingPeriod = {
      trendYears: [2023, 2024, 2025, 2026],
      latestFullYear: 2025,
      latestYear: 2026,
      latestYearPartialThrough: "June",
      asOfDate: "2026-06-30",
    };

    const tenant = {
      reportingFxRate: customRate,
      reportingPeriod: customPeriod,
    };

    expect(reportingFxRateForTenant(tenant).nprPerUsd).toBe(142.5);
    expect(trendYearsForTenant(tenant)).toEqual([2023, 2024, 2025, 2026]);
    expect(latestFullYearForTenant(tenant)).toBe(2025);
    expect(latestYearForTenant(tenant)).toBe(2026);
    expect(latestYearPartialThroughForTenant(tenant)).toBe("June");
    expect(asOfDateForTenant(tenant)).toBe("2026-06-30");
  });
});

describe("Arithmetic neutrality for demo tenants", () => {
  it("demo tenant with undefined overrides gets identical values to constants", () => {
    // Demo tenant leaves both fields undefined
    const demoTenant = {
      reportingFxRate: undefined,
      reportingPeriod: undefined,
    };

    // FX rate should be identical to constant
    const fxRate = reportingFxRateForTenant(demoTenant);
    expect(fxRate).toEqual(REPORTING_FX_RATE);
    expect(fxRate.nprPerUsd).toBe(133.5);
    expect(fxRate.asOf).toBe("2024-07-15");

    // Period values should be identical to constants
    expect(trendYearsForTenant(demoTenant)).toEqual([2021, 2022, 2023, 2024, 2025]);
    expect(latestFullYearForTenant(demoTenant)).toBe(2024);
    expect(latestYearForTenant(demoTenant)).toBe(2025);
    expect(latestYearPartialThroughForTenant(demoTenant)).toBe("October");
    expect(asOfDateForTenant(demoTenant)).toBe("2025-10-31");
  });

  it("empty tenant object (no fields set) gets identical values to constants", () => {
    const emptyTenant = {};

    expect(reportingFxRateForTenant(emptyTenant)).toEqual(REPORTING_FX_RATE);
    expect(trendYearsForTenant(emptyTenant)).toEqual(TREND_YEARS);
    expect(latestFullYearForTenant(emptyTenant)).toBe(LATEST_FULL_YEAR);
    expect(asOfDateForTenant(emptyTenant)).toBe(AS_OF_DATE);
  });
});

describe("Edge cases", () => {
  it("handles FY2026 bank with single-year trend", () => {
    const fy2026Period: ReportingPeriod = {
      trendYears: [2026],
      latestFullYear: 2026,
      latestYear: 2026,
      asOfDate: "2026-12-31",
    };

    const tenant = { reportingPeriod: fy2026Period };

    expect(trendYearsForTenant(tenant)).toEqual([2026]);
    expect(latestFullYearForTenant(tenant)).toBe(2026);
    expect(latestYearForTenant(tenant)).toBe(2026);
    expect(latestYearPartialThroughForTenant(tenant)).toBeUndefined();
    expect(asOfDateForTenant(tenant)).toBe("2026-12-31");
  });

  it("handles bank with 10-year historical trend", () => {
    const longPeriod: ReportingPeriod = {
      trendYears: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
      latestFullYear: 2024,
      latestYear: 2024,
      asOfDate: "2024-12-31",
    };

    const tenant = { reportingPeriod: longPeriod };

    expect(trendYearsForTenant(tenant).length).toBe(10);
    expect(trendYearsForTenant(tenant)[0]).toBe(2015);
    expect(trendYearsForTenant(tenant)[9]).toBe(2024);
  });

  it("handles zero exchange rate (boundary case)", () => {
    const zeroRate: FxRate = {
      nprPerUsd: 0,
      asOf: "2025-01-01",
      source: "Test zero rate",
    };

    const tenant = { reportingFxRate: zeroRate };
    const result = reportingFxRateForTenant(tenant);

    expect(result.nprPerUsd).toBe(0);
  });

  it("handles very high exchange rate (hyperinflation scenario)", () => {
    const highRate: FxRate = {
      nprPerUsd: 999999.99,
      asOf: "2025-01-01",
      source: "Test high rate",
    };

    const tenant = { reportingFxRate: highRate };
    const result = reportingFxRateForTenant(tenant);

    expect(result.nprPerUsd).toBe(999999.99);
  });
});
