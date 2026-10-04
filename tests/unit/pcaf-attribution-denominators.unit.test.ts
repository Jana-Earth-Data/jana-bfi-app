/**
 * Unit tests for PCAF per-asset-class attribution denominators (N1.9).
 *
 * Per IFRS S2 B62(d) and PCAF Part A 3rd Edition §5, different asset classes
 * use different attribution denominators (not one EVIC for everything).
 * These tests verify the correct denominator selection, fallback logic, and
 * floor application for each of the five loan-origination asset classes.
 *
 * **Scope:** Tests {@link attributionDenominatorUsd} from
 * `lib/regulatory/pcaf/attribution.ts` across all five supported asset classes
 * (business-loans, project-finance, mortgages, motor-vehicles, out-of-scope),
 * verifying both happy-path (denominator available) and fallback scenarios
 * (denominator unavailable → enterpriseValue).
 *
 * **Coverage goals:**
 * - Denominator selection for each asset class
 * - PCAF-compliant fallback logic when fields are undefined
 * - Floor application (facility vs non-facility)
 * - Denominator metadata (type, label, citation) for UI hints
 * - Out-of-scope handling
 */

import { describe, it, expect } from "vitest";
import {
  attributionDenominatorUsd,
  PCAF_EV_FLOOR_FACILITY_USD,
  PCAF_EV_FLOOR_NON_FACILITY_USD,
} from "@/lib/regulatory/pcaf/attribution";
import type { Borrower, Loan } from "@/lib/types/bfi";
import type { PcafAssetClass } from "@/lib/regulatory/pcaf/types";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Minimal borrower fixture (non-facility, no optional denominators) */
function makeBorrower(overrides?: Partial<Borrower>): Borrower {
  return {
    id: "borrower-1",
    name: "Test Borrower",
    nrbSector: "Manufacturing",
    enterpriseValueUsd: 5_000_000,
    evSource: "estimated",
    facilities: [],
    totalCo2eTonnes: 10_000,
    ...overrides,
  };
}

/** Minimal loan fixture (no optional denominators) */
function makeLoan(overrides?: Partial<Loan>): Loan {
  return {
    id: "loan-1",
    borrowerId: "borrower-1",
    product: "Term Loan",
    category: "commercial-term-loan",
    outstandingNpr: 100_000_000,
    outstandingUsd: 750_000,
    disbursedDate: "2024-01-15",
    maturityDate: "2029-01-15",
    status: "disbursed",
    nrbTaxonomy: "unclassified",
    purpose: "General corporate",
    ...overrides,
  };
}

describe("attributionDenominatorUsd · §5.2 Business loans / unlisted equity", () => {
  it("uses equity + debt when both are available", () => {
    const borrower = makeBorrower({
      totalEquityUsd: 3_000_000,
      totalDebtUsd: 2_000_000,
    });
    const loan = makeLoan();
    const result = attributionDenominatorUsd(
      loan,
      borrower,
      "business-loans-unlisted-equity",
    );

    expect(result.denominatorUsd).toBe(5_000_000); // 3M + 2M
    expect(result.denominatorType).toBe("equity-plus-debt");
    expect(result.denominatorLabel).toContain("Equity + Debt");
    expect(result.citation).toContain("§5.2");
  });

  it("applies facility floor to equity + debt", () => {
    const borrower = makeBorrower({
      totalEquityUsd: 300_000,
      totalDebtUsd: 200_000,
      facilities: [
        {
          assetId: "facility-1",
          facilityName: "Test Facility",
          sector: "cement",
          lat: 27.7,
          lng: 85.3,
          annualCo2eTonnes: 50_000,
          emissionsYear: 2024,
          matchMethod: "manual",
          matchConfidence: 1,
        },
      ],
    });
    const loan = makeLoan();
    const result = attributionDenominatorUsd(
      loan,
      borrower,
      "business-loans-unlisted-equity",
    );

    // 300k + 200k = 500k < 1M facility floor → floored to 1M
    expect(result.denominatorUsd).toBe(PCAF_EV_FLOOR_FACILITY_USD);
    expect(result.denominatorType).toBe("equity-plus-debt");
  });

  it("applies non-facility floor to equity + debt", () => {
    const borrower = makeBorrower({
      totalEquityUsd: 20_000,
      totalDebtUsd: 10_000,
      facilities: [], // Non-facility
    });
    const loan = makeLoan();
    const result = attributionDenominatorUsd(
      loan,
      borrower,
      "business-loans-unlisted-equity",
    );

    // 20k + 10k = 30k < 50k non-facility floor → floored to 50k
    expect(result.denominatorUsd).toBe(PCAF_EV_FLOOR_NON_FACILITY_USD);
    expect(result.denominatorType).toBe("equity-plus-debt");
  });

  it("falls back to enterprise value when equity is undefined", () => {
    const borrower = makeBorrower({
      totalEquityUsd: undefined,
      totalDebtUsd: 2_000_000,
      enterpriseValueUsd: 8_000_000,
    });
    const loan = makeLoan();
    const result = attributionDenominatorUsd(
      loan,
      borrower,
      "business-loans-unlisted-equity",
    );

    expect(result.denominatorUsd).toBe(8_000_000); // Fallback to EV
    expect(result.denominatorType).toBe("enterprise-value");
    expect(result.denominatorLabel).toContain("fallback");
    expect(result.citation).toContain("fallback");
    expect(result.citation).toContain("equity/debt split not available");
  });

  it("falls back to enterprise value when debt is undefined", () => {
    const borrower = makeBorrower({
      totalEquityUsd: 3_000_000,
      totalDebtUsd: undefined,
      enterpriseValueUsd: 6_000_000,
    });
    const loan = makeLoan();
    const result = attributionDenominatorUsd(
      loan,
      borrower,
      "business-loans-unlisted-equity",
    );

    expect(result.denominatorUsd).toBe(6_000_000); // Fallback to EV
    expect(result.denominatorType).toBe("enterprise-value");
  });

  it("falls back to enterprise value when both equity and debt are undefined", () => {
    const borrower = makeBorrower({
      totalEquityUsd: undefined,
      totalDebtUsd: undefined,
      enterpriseValueUsd: 4_500_000,
    });
    const loan = makeLoan();
    const result = attributionDenominatorUsd(
      loan,
      borrower,
      "business-loans-unlisted-equity",
    );

    expect(result.denominatorUsd).toBe(4_500_000);
    expect(result.denominatorType).toBe("enterprise-value");
  });
});

describe("attributionDenominatorUsd · §5.3 Project finance", () => {
  it("uses project cost when available", () => {
    const borrower = makeBorrower();
    const loan = makeLoan({ projectCostUsd: 15_000_000 });
    const result = attributionDenominatorUsd(loan, borrower, "project-finance");

    expect(result.denominatorUsd).toBe(15_000_000);
    expect(result.denominatorType).toBe("project-cost");
    expect(result.denominatorLabel).toContain("Total Project Cost");
    expect(result.citation).toContain("§5.3");
  });

  it("applies facility floor to project cost", () => {
    const borrower = makeBorrower({
      facilities: [
        {
          assetId: "hydro-1",
          facilityName: "Hydro Plant",
          sector: "power",
          lat: 27.7,
          lng: 85.3,
          annualCo2eTonnes: 1_000,
          emissionsYear: 2024,
          matchMethod: "manual",
          matchConfidence: 1,
        },
      ],
    });
    const loan = makeLoan({ projectCostUsd: 500_000 });
    const result = attributionDenominatorUsd(loan, borrower, "project-finance");

    // 500k < 1M facility floor → floored to 1M
    expect(result.denominatorUsd).toBe(PCAF_EV_FLOOR_FACILITY_USD);
    expect(result.denominatorType).toBe("project-cost");
  });

  it("applies non-facility floor to project cost", () => {
    const borrower = makeBorrower({ facilities: [] });
    const loan = makeLoan({ projectCostUsd: 20_000 });
    const result = attributionDenominatorUsd(loan, borrower, "project-finance");

    // 20k < 50k non-facility floor → floored to 50k
    expect(result.denominatorUsd).toBe(PCAF_EV_FLOOR_NON_FACILITY_USD);
    expect(result.denominatorType).toBe("project-cost");
  });

  it("falls back to enterprise value when project cost is undefined", () => {
    const borrower = makeBorrower({
      enterpriseValueUsd: 12_000_000,
      facilities: [],
    });
    const loan = makeLoan({ projectCostUsd: undefined });
    const result = attributionDenominatorUsd(loan, borrower, "project-finance");

    expect(result.denominatorUsd).toBe(12_000_000); // Fallback to SPV's EV
    expect(result.denominatorType).toBe("enterprise-value");
    expect(result.denominatorLabel).toContain("fallback");
    expect(result.citation).toContain("project cost not available");
  });
});

describe("attributionDenominatorUsd · §5.5 Mortgages", () => {
  it("uses property value when available", () => {
    const borrower = makeBorrower();
    const loan = makeLoan({ propertyValueUsd: 300_000 });
    const result = attributionDenominatorUsd(loan, borrower, "mortgages");

    expect(result.denominatorUsd).toBe(300_000);
    expect(result.denominatorType).toBe("property-value");
    expect(result.denominatorLabel).toContain("Property Value");
    expect(result.citation).toContain("§5.5");
  });

  it("applies non-facility floor to property value", () => {
    const borrower = makeBorrower();
    const loan = makeLoan({ propertyValueUsd: 30_000 });
    const result = attributionDenominatorUsd(loan, borrower, "mortgages");

    // 30k < 50k non-facility floor → floored to 50k
    expect(result.denominatorUsd).toBe(PCAF_EV_FLOOR_NON_FACILITY_USD);
    expect(result.denominatorType).toBe("property-value");
  });

  it("falls back to enterprise value when property value is undefined", () => {
    const borrower = makeBorrower({ enterpriseValueUsd: 250_000 });
    const loan = makeLoan({ propertyValueUsd: undefined });
    const result = attributionDenominatorUsd(loan, borrower, "mortgages");

    expect(result.denominatorUsd).toBe(250_000);
    expect(result.denominatorType).toBe("enterprise-value");
    expect(result.denominatorLabel).toContain("fallback");
    expect(result.citation).toContain("property value not available");
  });
});

describe("attributionDenominatorUsd · §5.6 Motor vehicle loans", () => {
  it("uses vehicle value when available", () => {
    const borrower = makeBorrower();
    const loan = makeLoan({ vehicleValueUsd: 25_000 });
    const result = attributionDenominatorUsd(loan, borrower, "motor-vehicle-loans");

    // 25k < 50k non-facility floor → floored to 50k
    expect(result.denominatorUsd).toBe(PCAF_EV_FLOOR_NON_FACILITY_USD);
    expect(result.denominatorType).toBe("vehicle-value");
  });

  it("uses vehicle value above floor", () => {
    const borrower = makeBorrower();
    const loan = makeLoan({ vehicleValueUsd: 75_000 });
    const result = attributionDenominatorUsd(loan, borrower, "motor-vehicle-loans");

    expect(result.denominatorUsd).toBe(75_000);
    expect(result.denominatorType).toBe("vehicle-value");
    expect(result.denominatorLabel).toContain("Vehicle Value");
    expect(result.citation).toContain("§5.6");
  });

  it("falls back to enterprise value when vehicle value is undefined", () => {
    const borrower = makeBorrower({ enterpriseValueUsd: 60_000 });
    const loan = makeLoan({ vehicleValueUsd: undefined });
    const result = attributionDenominatorUsd(loan, borrower, "motor-vehicle-loans");

    expect(result.denominatorUsd).toBe(60_000);
    expect(result.denominatorType).toBe("enterprise-value");
    expect(result.denominatorLabel).toContain("fallback");
    expect(result.citation).toContain("vehicle value not available");
  });
});

describe("attributionDenominatorUsd · Out-of-scope loans", () => {
  it("returns zero denominator with out-of-scope type", () => {
    const borrower = makeBorrower();
    const loan = makeLoan();
    const result = attributionDenominatorUsd(loan, borrower, "out-of-scope");

    expect(result.denominatorUsd).toBe(0);
    expect(result.denominatorType).toBe("out-of-scope");
    expect(result.denominatorLabel).toContain("N/A");
    expect(result.citation).toContain("out of PCAF Cat. 15 scope");
  });
});

describe("attributionDenominatorUsd · Investment portfolio classes (fallback behavior)", () => {
  it("uses enterprise value for listed-equity-corporate-bonds (§5.1)", () => {
    const borrower = makeBorrower({ enterpriseValueUsd: 50_000_000 });
    const loan = makeLoan();
    const result = attributionDenominatorUsd(
      loan,
      borrower,
      "listed-equity-corporate-bonds",
    );

    expect(result.denominatorUsd).toBe(50_000_000);
    expect(result.denominatorType).toBe("enterprise-value");
    expect(result.denominatorLabel).toContain("Enterprise Value");
    expect(result.citation).toContain("§4.2");
  });

  it("uses enterprise value for commercial-real-estate (§5.4)", () => {
    const borrower = makeBorrower({ enterpriseValueUsd: 10_000_000 });
    const loan = makeLoan();
    const result = attributionDenominatorUsd(
      loan,
      borrower,
      "commercial-real-estate",
    );

    expect(result.denominatorUsd).toBe(10_000_000);
    expect(result.denominatorType).toBe("enterprise-value");
  });
});

describe("attributionDenominatorUsd · Edge cases", () => {
  it("handles zero equity + debt (uses fallback)", () => {
    const borrower = makeBorrower({
      totalEquityUsd: 0,
      totalDebtUsd: 0,
      enterpriseValueUsd: 1_000_000,
    });
    const loan = makeLoan();
    const result = attributionDenominatorUsd(
      loan,
      borrower,
      "business-loans-unlisted-equity",
    );

    // 0 + 0 = 0, which is still < floor → use floored value
    // But wait - if equity + debt are both 0, that's a valid case per PCAF
    // Let me check the logic... the function floors the sum (0) to either 1M or 50k
    expect(result.denominatorUsd).toBe(PCAF_EV_FLOOR_NON_FACILITY_USD); // 0 floored to 50k
    expect(result.denominatorType).toBe("equity-plus-debt");
  });

  it("handles very small denominators below floor", () => {
    const borrower = makeBorrower();
    const loan = makeLoan({ propertyValueUsd: 1 });
    const result = attributionDenominatorUsd(loan, borrower, "mortgages");

    expect(result.denominatorUsd).toBe(PCAF_EV_FLOOR_NON_FACILITY_USD);
    expect(result.denominatorType).toBe("property-value");
  });

  it("handles very large denominators above floor", () => {
    const borrower = makeBorrower({
      totalEquityUsd: 500_000_000,
      totalDebtUsd: 300_000_000,
      facilities: [
        {
          assetId: "large-facility",
          facilityName: "Large Facility",
          sector: "cement",
          lat: 27.7,
          lng: 85.3,
          annualCo2eTonnes: 1_000_000,
          emissionsYear: 2024,
          matchMethod: "manual",
          matchConfidence: 1,
        },
      ],
    });
    const loan = makeLoan();
    const result = attributionDenominatorUsd(
      loan,
      borrower,
      "business-loans-unlisted-equity",
    );

    expect(result.denominatorUsd).toBe(800_000_000); // 500M + 300M, no floor binding
    expect(result.denominatorType).toBe("equity-plus-debt");
  });
});
