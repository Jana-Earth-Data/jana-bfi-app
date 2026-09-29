/**
 * Unit tests for N1.11 — IFRS S2 B55–B56 data extent disclosure.
 *
 * Per IFRS S2 Climate-related Disclosures (June 2023):
 * - §B55: Disclose the extent to which financed emissions are measured using
 *   primary-activity data (borrower-specific operational data)
 * - §B56: Disclose the extent using verified data (third-party assured)
 *
 * These requirements map to PCAF data quality options:
 * - Primary-activity data: Options 2a (energy records) and 2b (production records)
 * - Verified data: Option 1a (third-party assurance opinion)
 *
 * Tests verify the computation produces correct counts, exposure, emissions, and
 * percentages for each extent metric.
 */

import { describe, it, expect } from "vitest";
import { computeDataExtentDisclosure } from "@/lib/regulatory/pcaf/data-extent";
import type { Loan, PcafAttribution } from "@/lib/types/bfi";

// Test helpers
function makeLoan(id: string, outstandingUsd: number): Loan {
  return {
    id,
    borrowerId: `borrower-${id}`,
    product: "SME Working Capital",
    outstandingNpr: outstandingUsd * 133.5,
    outstandingUsd,
    disbursedDate: "2024-01-01",
    maturityDate: "2029-01-01",
    status: "disbursed",
    nrbTaxonomy: "unclassified",
    purpose: "Working capital",
    category: "sme-working-capital",
  };
}

function makeAttribution(
  loanId: string,
  opts: {
    pcafOption?: "1a" | "1b" | "2a" | "2b" | "3a" | "3b" | "3c";
    attributedCo2eTonnes?: number;
  } = {},
): PcafAttribution {
  return {
    loanId,
    borrowerId: `borrower-${loanId}`,
    attributionFactor: 0.5,
    attributedCo2eTonnes: opts.attributedCo2eTonnes ?? 100,
    dataQualityScore: 3,
    qualityNote: "Test attribution",
    pcafOption: opts.pcafOption,
  };
}

describe("computeDataExtentDisclosure - Basic Aggregation", () => {
  it("aggregates primary-activity data (Options 2a, 2b)", () => {
    const loans = [
      makeLoan("loan-1", 1_000_000), // Option 2a
      makeLoan("loan-2", 500_000),   // Option 2b
      makeLoan("loan-3", 300_000),   // Option 3a (not primary-activity)
    ];
    const attributions = [
      makeAttribution("loan-1", { pcafOption: "2a", attributedCo2eTonnes: 200 }),
      makeAttribution("loan-2", { pcafOption: "2b", attributedCo2eTonnes: 100 }),
      makeAttribution("loan-3", { pcafOption: "3a", attributedCo2eTonnes: 50 }),
    ];

    const disclosure = computeDataExtentDisclosure(attributions, loans);

    // Primary-activity data extent
    expect(disclosure.primaryActivityData.loanCount).toBe(2);
    expect(disclosure.primaryActivityData.grossExposureUsd).toBe(1_500_000);
    expect(disclosure.primaryActivityData.attributedCo2eTonnes).toBe(300);

    // Percentages (total: 3 loans, 1.8M USD, 350 tonnes)
    expect(disclosure.primaryActivityData.percentOfLoans).toBeCloseTo(66.67, 1);
    expect(disclosure.primaryActivityData.percentOfExposure).toBeCloseTo(83.33, 1);
    expect(disclosure.primaryActivityData.percentOfEmissions).toBeCloseTo(85.71, 1);
  });

  it("aggregates verified data (Option 1a)", () => {
    const loans = [
      makeLoan("loan-1", 2_000_000), // Option 1a
      makeLoan("loan-2", 1_000_000), // Option 1b (not verified)
      makeLoan("loan-3", 500_000),   // Option 2a (not verified)
    ];
    const attributions = [
      makeAttribution("loan-1", { pcafOption: "1a", attributedCo2eTonnes: 400 }),
      makeAttribution("loan-2", { pcafOption: "1b", attributedCo2eTonnes: 200 }),
      makeAttribution("loan-3", { pcafOption: "2a", attributedCo2eTonnes: 100 }),
    ];

    const disclosure = computeDataExtentDisclosure(attributions, loans);

    // Verified data extent
    expect(disclosure.verifiedData.loanCount).toBe(1);
    expect(disclosure.verifiedData.grossExposureUsd).toBe(2_000_000);
    expect(disclosure.verifiedData.attributedCo2eTonnes).toBe(400);

    // Percentages (total: 3 loans, 3.5M USD, 700 tonnes)
    expect(disclosure.verifiedData.percentOfLoans).toBeCloseTo(33.33, 1);
    expect(disclosure.verifiedData.percentOfExposure).toBeCloseTo(57.14, 1);
    expect(disclosure.verifiedData.percentOfEmissions).toBeCloseTo(57.14, 1);
  });

  it("handles loans with both primary-activity and verified classifications separately", () => {
    // A loan can be EITHER primary-activity (2a/2b) OR verified (1a), not both
    // (PCAF options are mutually exclusive per attribution)
    const loans = [
      makeLoan("loan-1", 1_000_000), // Verified (1a)
      makeLoan("loan-2", 500_000),   // Primary-activity (2a)
    ];
    const attributions = [
      makeAttribution("loan-1", { pcafOption: "1a", attributedCo2eTonnes: 200 }),
      makeAttribution("loan-2", { pcafOption: "2a", attributedCo2eTonnes: 100 }),
    ];

    const disclosure = computeDataExtentDisclosure(attributions, loans);

    // Verified extent
    expect(disclosure.verifiedData.loanCount).toBe(1);
    expect(disclosure.verifiedData.grossExposureUsd).toBe(1_000_000);
    expect(disclosure.verifiedData.attributedCo2eTonnes).toBe(200);

    // Primary-activity extent
    expect(disclosure.primaryActivityData.loanCount).toBe(1);
    expect(disclosure.primaryActivityData.grossExposureUsd).toBe(500_000);
    expect(disclosure.primaryActivityData.attributedCo2eTonnes).toBe(100);
  });
});

describe("computeDataExtentDisclosure - Edge Cases", () => {
  it("handles empty portfolio", () => {
    const disclosure = computeDataExtentDisclosure([], []);

    expect(disclosure.primaryActivityData.loanCount).toBe(0);
    expect(disclosure.primaryActivityData.percentOfLoans).toBe(0);
    expect(disclosure.primaryActivityData.grossExposureUsd).toBe(0);
    expect(disclosure.primaryActivityData.percentOfExposure).toBe(0);
    expect(disclosure.primaryActivityData.attributedCo2eTonnes).toBe(0);
    expect(disclosure.primaryActivityData.percentOfEmissions).toBe(0);

    expect(disclosure.verifiedData.loanCount).toBe(0);
    expect(disclosure.verifiedData.percentOfLoans).toBe(0);
    expect(disclosure.verifiedData.grossExposureUsd).toBe(0);
    expect(disclosure.verifiedData.percentOfExposure).toBe(0);
    expect(disclosure.verifiedData.attributedCo2eTonnes).toBe(0);
    expect(disclosure.verifiedData.percentOfEmissions).toBe(0);
  });

  it("handles portfolio with no primary-activity data", () => {
    const loans = [
      makeLoan("loan-1", 1_000_000),
      makeLoan("loan-2", 500_000),
    ];
    const attributions = [
      makeAttribution("loan-1", { pcafOption: "1a", attributedCo2eTonnes: 200 }),
      makeAttribution("loan-2", { pcafOption: "3a", attributedCo2eTonnes: 100 }),
    ];

    const disclosure = computeDataExtentDisclosure(attributions, loans);

    // No primary-activity data
    expect(disclosure.primaryActivityData.loanCount).toBe(0);
    expect(disclosure.primaryActivityData.percentOfLoans).toBe(0);
    expect(disclosure.primaryActivityData.grossExposureUsd).toBe(0);
    expect(disclosure.primaryActivityData.percentOfExposure).toBe(0);
    expect(disclosure.primaryActivityData.attributedCo2eTonnes).toBe(0);
    expect(disclosure.primaryActivityData.percentOfEmissions).toBe(0);

    // Verified data present
    expect(disclosure.verifiedData.loanCount).toBe(1);
  });

  it("handles portfolio with no verified data", () => {
    const loans = [
      makeLoan("loan-1", 1_000_000),
      makeLoan("loan-2", 500_000),
    ];
    const attributions = [
      makeAttribution("loan-1", { pcafOption: "2a", attributedCo2eTonnes: 200 }),
      makeAttribution("loan-2", { pcafOption: "3a", attributedCo2eTonnes: 100 }),
    ];

    const disclosure = computeDataExtentDisclosure(attributions, loans);

    // No verified data
    expect(disclosure.verifiedData.loanCount).toBe(0);
    expect(disclosure.verifiedData.percentOfLoans).toBe(0);
    expect(disclosure.verifiedData.grossExposureUsd).toBe(0);
    expect(disclosure.verifiedData.percentOfExposure).toBe(0);
    expect(disclosure.verifiedData.attributedCo2eTonnes).toBe(0);
    expect(disclosure.verifiedData.percentOfEmissions).toBe(0);

    // Primary-activity data present
    expect(disclosure.primaryActivityData.loanCount).toBe(1);
  });

  it("handles portfolio where all loans use primary-activity data", () => {
    const loans = [
      makeLoan("loan-1", 1_000_000),
      makeLoan("loan-2", 500_000),
      makeLoan("loan-3", 300_000),
    ];
    const attributions = [
      makeAttribution("loan-1", { pcafOption: "2a", attributedCo2eTonnes: 200 }),
      makeAttribution("loan-2", { pcafOption: "2b", attributedCo2eTonnes: 100 }),
      makeAttribution("loan-3", { pcafOption: "2a", attributedCo2eTonnes: 50 }),
    ];

    const disclosure = computeDataExtentDisclosure(attributions, loans);

    // 100% primary-activity data
    expect(disclosure.primaryActivityData.loanCount).toBe(3);
    expect(disclosure.primaryActivityData.percentOfLoans).toBe(100);
    expect(disclosure.primaryActivityData.grossExposureUsd).toBe(1_800_000);
    expect(disclosure.primaryActivityData.percentOfExposure).toBe(100);
    expect(disclosure.primaryActivityData.attributedCo2eTonnes).toBe(350);
    expect(disclosure.primaryActivityData.percentOfEmissions).toBe(100);
  });

  it("handles portfolio where all loans use verified data", () => {
    const loans = [
      makeLoan("loan-1", 1_000_000),
      makeLoan("loan-2", 500_000),
    ];
    const attributions = [
      makeAttribution("loan-1", { pcafOption: "1a", attributedCo2eTonnes: 200 }),
      makeAttribution("loan-2", { pcafOption: "1a", attributedCo2eTonnes: 100 }),
    ];

    const disclosure = computeDataExtentDisclosure(attributions, loans);

    // 100% verified data
    expect(disclosure.verifiedData.loanCount).toBe(2);
    expect(disclosure.verifiedData.percentOfLoans).toBe(100);
    expect(disclosure.verifiedData.grossExposureUsd).toBe(1_500_000);
    expect(disclosure.verifiedData.percentOfExposure).toBe(100);
    expect(disclosure.verifiedData.attributedCo2eTonnes).toBe(300);
    expect(disclosure.verifiedData.percentOfEmissions).toBe(100);
  });
});

describe("computeDataExtentDisclosure - Backward Compatibility", () => {
  it("handles attributions without pcafOption (pre-N1.8 data)", () => {
    const loans = [
      makeLoan("loan-1", 1_000_000),
      makeLoan("loan-2", 500_000),
    ];
    const attributions = [
      makeAttribution("loan-1", { attributedCo2eTonnes: 200 }), // pcafOption undefined
      makeAttribution("loan-2", { attributedCo2eTonnes: 100 }), // pcafOption undefined
    ];

    const disclosure = computeDataExtentDisclosure(attributions, loans);

    // No primary-activity or verified data when pcafOption is undefined
    expect(disclosure.primaryActivityData.loanCount).toBe(0);
    expect(disclosure.verifiedData.loanCount).toBe(0);
  });

  it("handles mixed portfolio with some undefined pcafOptions", () => {
    const loans = [
      makeLoan("loan-1", 1_000_000),
      makeLoan("loan-2", 500_000),
      makeLoan("loan-3", 300_000),
    ];
    const attributions = [
      makeAttribution("loan-1", { pcafOption: "2a", attributedCo2eTonnes: 200 }),
      makeAttribution("loan-2", { attributedCo2eTonnes: 100 }), // undefined
      makeAttribution("loan-3", { pcafOption: "1a", attributedCo2eTonnes: 50 }),
    ];

    const disclosure = computeDataExtentDisclosure(attributions, loans);

    // Only loans with defined pcafOption are counted
    expect(disclosure.primaryActivityData.loanCount).toBe(1);
    expect(disclosure.verifiedData.loanCount).toBe(1);

    // Percentages are against total portfolio (3 loans, 1.8M USD, 350 tonnes)
    expect(disclosure.primaryActivityData.percentOfLoans).toBeCloseTo(33.33, 1);
    expect(disclosure.verifiedData.percentOfLoans).toBeCloseTo(33.33, 1);
  });
});

describe("computeDataExtentDisclosure - Percentage Calculations", () => {
  it("calculates percentages correctly for partial coverage", () => {
    const loans = [
      makeLoan("loan-1", 4_000_000),
      makeLoan("loan-2", 2_000_000),
      makeLoan("loan-3", 1_000_000),
      makeLoan("loan-4", 500_000),
    ];
    const attributions = [
      makeAttribution("loan-1", { pcafOption: "1a", attributedCo2eTonnes: 400 }),
      makeAttribution("loan-2", { pcafOption: "2a", attributedCo2eTonnes: 200 }),
      makeAttribution("loan-3", { pcafOption: "3a", attributedCo2eTonnes: 100 }),
      makeAttribution("loan-4", { pcafOption: "3b", attributedCo2eTonnes: 50 }),
    ];

    const disclosure = computeDataExtentDisclosure(attributions, loans);

    // Totals: 4 loans, 7.5M USD, 750 tonnes

    // Verified: 1 loan (25%), 4M USD (53.33%), 400 tonnes (53.33%)
    expect(disclosure.verifiedData.loanCount).toBe(1);
    expect(disclosure.verifiedData.percentOfLoans).toBe(25);
    expect(disclosure.verifiedData.percentOfExposure).toBeCloseTo(53.33, 1);
    expect(disclosure.verifiedData.percentOfEmissions).toBeCloseTo(53.33, 1);

    // Primary-activity: 1 loan (25%), 2M USD (26.67%), 200 tonnes (26.67%)
    expect(disclosure.primaryActivityData.loanCount).toBe(1);
    expect(disclosure.primaryActivityData.percentOfLoans).toBe(25);
    expect(disclosure.primaryActivityData.percentOfExposure).toBeCloseTo(26.67, 1);
    expect(disclosure.primaryActivityData.percentOfEmissions).toBeCloseTo(26.67, 1);
  });

  it("rounds percentages to two decimal places", () => {
    const loans = [
      makeLoan("loan-1", 1_000_000),
      makeLoan("loan-2", 1_000_000),
      makeLoan("loan-3", 1_000_000),
    ];
    const attributions = [
      makeAttribution("loan-1", { pcafOption: "2a", attributedCo2eTonnes: 100 }),
      makeAttribution("loan-2", { pcafOption: "3a", attributedCo2eTonnes: 100 }),
      makeAttribution("loan-3", { pcafOption: "3a", attributedCo2eTonnes: 100 }),
    ];

    const disclosure = computeDataExtentDisclosure(attributions, loans);

    // 1 of 3 loans = 33.333... % -> should round to 33.33
    expect(disclosure.primaryActivityData.percentOfLoans).toBe(33.33);
    expect(disclosure.primaryActivityData.percentOfExposure).toBe(33.33);
    expect(disclosure.primaryActivityData.percentOfEmissions).toBe(33.33);
  });
});

describe("computeDataExtentDisclosure - Large Portfolio", () => {
  it("handles large portfolio efficiently", () => {
    const loans: Loan[] = [];
    const attributions: PcafAttribution[] = [];

    // Create 10,000 loans with mixed options
    for (let i = 0; i < 10_000; i++) {
      const id = `loan-${i}`;
      loans.push(makeLoan(id, 100_000));

      // Distribute across options: 10% 1a, 20% 2a/2b, 70% other
      let option: "1a" | "2a" | "2b" | "3a" | undefined;
      if (i < 1_000) option = "1a";
      else if (i < 3_000) option = i % 2 === 0 ? "2a" : "2b";
      else option = "3a";

      attributions.push(makeAttribution(id, { pcafOption: option, attributedCo2eTonnes: 10 }));
    }

    const disclosure = computeDataExtentDisclosure(attributions, loans);

    // Verified: 1,000 loans (10%)
    expect(disclosure.verifiedData.loanCount).toBe(1_000);
    expect(disclosure.verifiedData.percentOfLoans).toBe(10);
    expect(disclosure.verifiedData.grossExposureUsd).toBe(100_000_000);
    expect(disclosure.verifiedData.attributedCo2eTonnes).toBe(10_000);

    // Primary-activity: 2,000 loans (20%)
    expect(disclosure.primaryActivityData.loanCount).toBe(2_000);
    expect(disclosure.primaryActivityData.percentOfLoans).toBe(20);
    expect(disclosure.primaryActivityData.grossExposureUsd).toBe(200_000_000);
    expect(disclosure.primaryActivityData.attributedCo2eTonnes).toBe(20_000);
  });
});

describe("computeDataExtentDisclosure - Both Options 2a and 2b", () => {
  it("counts both 2a and 2b as primary-activity data", () => {
    const loans = [
      makeLoan("loan-1", 1_000_000), // Energy records (2a)
      makeLoan("loan-2", 500_000),   // Production records (2b)
      makeLoan("loan-3", 300_000),   // Revenue-based (3a)
    ];
    const attributions = [
      makeAttribution("loan-1", { pcafOption: "2a", attributedCo2eTonnes: 200 }),
      makeAttribution("loan-2", { pcafOption: "2b", attributedCo2eTonnes: 100 }),
      makeAttribution("loan-3", { pcafOption: "3a", attributedCo2eTonnes: 50 }),
    ];

    const disclosure = computeDataExtentDisclosure(attributions, loans);

    // Both 2a and 2b counted as primary-activity
    expect(disclosure.primaryActivityData.loanCount).toBe(2);
    expect(disclosure.primaryActivityData.grossExposureUsd).toBe(1_500_000);
    expect(disclosure.primaryActivityData.attributedCo2eTonnes).toBe(300);
  });
});

describe("computeDataExtentDisclosure - Zero Emissions Edge Case", () => {
  it("handles loans with zero attributed emissions", () => {
    const loans = [
      makeLoan("loan-1", 1_000_000),
      makeLoan("loan-2", 500_000),
    ];
    const attributions = [
      makeAttribution("loan-1", { pcafOption: "1a", attributedCo2eTonnes: 0 }),
      makeAttribution("loan-2", { pcafOption: "2a", attributedCo2eTonnes: 100 }),
    ];

    const disclosure = computeDataExtentDisclosure(attributions, loans);

    // Verified data: 1 loan, 1M USD, 0 tonnes
    expect(disclosure.verifiedData.loanCount).toBe(1);
    expect(disclosure.verifiedData.grossExposureUsd).toBe(1_000_000);
    expect(disclosure.verifiedData.attributedCo2eTonnes).toBe(0);
    expect(disclosure.verifiedData.percentOfEmissions).toBe(0);

    // Primary-activity: 1 loan, 500k USD, 100 tonnes
    expect(disclosure.primaryActivityData.loanCount).toBe(1);
    expect(disclosure.primaryActivityData.grossExposureUsd).toBe(500_000);
    expect(disclosure.primaryActivityData.attributedCo2eTonnes).toBe(100);
    expect(disclosure.primaryActivityData.percentOfEmissions).toBe(100);
  });
});
