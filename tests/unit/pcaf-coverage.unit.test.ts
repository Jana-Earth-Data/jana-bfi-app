/**
 * UNIT TESTS — IFRS S2 B62(c) coverage computation.
 * jana-bfi-app · PR1 task N1.2 of PROJECT_PLAN.md (TEST_STRATEGY §4.1, Tier 1).
 *
 * SCOPE
 * -----
 *   • lib/regulatory/pcaf/coverage.ts — IFRS S2 B62(c) percentage of gross
 *     exposure included in financed-emissions calculation, with excluded asset
 *     types named.
 *
 * WHY
 * ---
 * `computeGrossExposureCoverage()` is the single source of truth for the B62(c)
 * disclosure formula (included exposure ÷ total exposure, with excluded types
 * listed). This function drives the annual NFRS/ISSB climate disclosures and
 * must produce stable, auditable numbers — so this test pins the arithmetic and
 * exercises the edge cases (empty portfolio, 100% included, 0% included, mixed
 * categories).
 *
 * N1.2 CORRECTION. This replaces the existing facility-matched ÷ in-scope ratio
 * with the correct denominator: **total gross exposure** (all loans), not
 * in-scope exposure.
 */
import { describe, expect, it } from "vitest";
import {
  IFRS_S2_B62C_CITATION,
  computeGrossExposureCoverage,
} from "@/lib/regulatory/pcaf/coverage";
import type { Loan, PcafAttribution } from "@/lib/types/bfi";

// ---------------------------------------------------------------------------
// Fixtures — minimal, only the fields the functions read.
// ---------------------------------------------------------------------------

function makeLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: "l-1",
    borrowerId: "b-1",
    product: "Term Loan",
    category: "commercial-term-loan",
    outstandingNpr: 1_000_000,
    outstandingUsd: 7_500,
    lossAllowance: 150, // 2% provision
    disbursedDate: "2024-01-15",
    maturityDate: "2029-01-15",
    status: "active",
    nrbTaxonomy: "unclassified",
    purpose: "Working capital",
    ...overrides,
  };
}

function makeAttribution(overrides: Partial<PcafAttribution> = {}): PcafAttribution {
  return {
    loanId: "l-1",
    borrowerId: "b-1",
    attributionFactor: 0.001,
    attributedCo2eTonnes: 100,
    dataQualityScore: 3,
    qualityNote: "test",
    pcafAssetClass: "business-loans-unlisted-equity",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeGrossExposureCoverage() — happy path
// ---------------------------------------------------------------------------

describe("computeGrossExposureCoverage — happy path", () => {
  it("computes coverage percentage correctly (all loans included)", () => {
    const loans = [
      makeLoan({ id: "l-1", outstandingUsd: 10_000, lossAllowance: 200 }),
      makeLoan({ id: "l-2", outstandingUsd: 5_000, lossAllowance: 100 }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1" }),
      makeAttribution({ loanId: "l-2" }),
    ];

    const coverage = computeGrossExposureCoverage(loans, attributions);

    // Total gross = (10k + 200) + (5k + 100) = 15,300
    // Included gross = same (all have attributions) = 15,300
    // Coverage = 100%
    expect(coverage.totalGrossExposureUsd).toBe(15_300);
    expect(coverage.includedGrossExposureUsd).toBe(15_300);
    expect(coverage.coveragePercent).toBe(100.0);
    expect(coverage.includedLoanCount).toBe(2);
    expect(coverage.excludedLoanCount).toBe(0);
    expect(coverage.excludedAssetTypes).toEqual([]);
  });

  it("computes coverage percentage correctly (partial inclusion)", () => {
    const loans = [
      makeLoan({ id: "l-1", outstandingUsd: 10_000, lossAllowance: 200, category: "commercial-term-loan" }),
      makeLoan({ id: "l-2", outstandingUsd: 4_000, lossAllowance: 0, category: "retail-mortgage" }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1" }), // Only l-1 included
    ];

    const coverage = computeGrossExposureCoverage(loans, attributions);

    // Total gross = (10k + 200) + (4k + 0) = 14,200
    // Included gross = 10k + 200 = 10,200
    // Coverage = 10,200 / 14,200 ≈ 71.83%
    expect(coverage.totalGrossExposureUsd).toBe(14_200);
    expect(coverage.includedGrossExposureUsd).toBe(10_200);
    expect(coverage.coveragePercent).toBe(71.83);
    expect(coverage.includedLoanCount).toBe(1);
    expect(coverage.excludedLoanCount).toBe(1);
    expect(coverage.excludedAssetTypes).toEqual(["Retail mortgages"]);
  });

  it("identifies excluded asset types correctly (multiple types)", () => {
    const loans = [
      makeLoan({ id: "l-1", category: "commercial-term-loan" }),
      makeLoan({ id: "l-2", category: "retail-mortgage" }),
      makeLoan({ id: "l-3", category: "retail-personal" }),
      makeLoan({ id: "l-4", category: "retail-vehicle" }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1" }), // Only commercial included
    ];

    const coverage = computeGrossExposureCoverage(loans, attributions);

    expect(coverage.excludedAssetTypes).toEqual([
      "Retail mortgages",
      "Retail personal loans",
      "Retail vehicle loans",
    ]);
  });

  it("rounds coverage percentage to 2 decimals", () => {
    const loans = [
      makeLoan({ id: "l-1", outstandingUsd: 7_000, lossAllowance: 0 }),
      makeLoan({ id: "l-2", outstandingUsd: 3_000, lossAllowance: 0 }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1" }),
    ];

    const coverage = computeGrossExposureCoverage(loans, attributions);

    // 7000 / 10000 = 70.00%
    expect(coverage.coveragePercent).toBe(70.0);
  });

  it("exposes an IFRS S2 B62(c) citation string", () => {
    expect(IFRS_S2_B62C_CITATION).toContain("IFRS S2");
    expect(IFRS_S2_B62C_CITATION).toContain("B62(c)");
  });
});

// ---------------------------------------------------------------------------
// computeGrossExposureCoverage() — edge cases
// ---------------------------------------------------------------------------

describe("computeGrossExposureCoverage — edge cases", () => {
  it("handles empty portfolio (0% coverage)", () => {
    const coverage = computeGrossExposureCoverage([], []);

    expect(coverage.totalGrossExposureUsd).toBe(0);
    expect(coverage.includedGrossExposureUsd).toBe(0);
    expect(coverage.coveragePercent).toBe(0);
    expect(coverage.includedLoanCount).toBe(0);
    expect(coverage.excludedLoanCount).toBe(0);
    expect(coverage.excludedAssetTypes).toEqual([]);
  });

  it("handles portfolio with zero attributions (0% coverage)", () => {
    const loans = [
      makeLoan({ id: "l-1", category: "retail-mortgage", outstandingUsd: 5_000, lossAllowance: 0 }),
      makeLoan({ id: "l-2", category: "retail-personal", outstandingUsd: 3_000, lossAllowance: 0 }),
    ];
    const attributions: PcafAttribution[] = []; // No attributions

    const coverage = computeGrossExposureCoverage(loans, attributions);

    expect(coverage.totalGrossExposureUsd).toBe(8_000);
    expect(coverage.includedGrossExposureUsd).toBe(0);
    expect(coverage.coveragePercent).toBe(0);
    expect(coverage.includedLoanCount).toBe(0);
    expect(coverage.excludedLoanCount).toBe(2);
    expect(coverage.excludedAssetTypes).toEqual([
      "Retail mortgages",
      "Retail personal loans",
    ]);
  });

  it("handles loans with undefined lossAllowance (uses outstandingUsd only)", () => {
    const loans = [
      makeLoan({ id: "l-1", outstandingUsd: 10_000, lossAllowance: undefined }),
      makeLoan({ id: "l-2", outstandingUsd: 5_000, lossAllowance: undefined }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1" }),
    ];

    const coverage = computeGrossExposureCoverage(loans, attributions);

    // Total gross = 10k + 5k = 15k (no loss allowance)
    // Included gross = 10k
    // Coverage = 66.67%
    expect(coverage.totalGrossExposureUsd).toBe(15_000);
    expect(coverage.includedGrossExposureUsd).toBe(10_000);
    expect(coverage.coveragePercent).toBe(66.67);
  });

  it("handles loans with undefined category (labeled as 'uncategorized')", () => {
    const loans = [
      makeLoan({ id: "l-1", category: undefined, outstandingUsd: 5_000 }),
    ];
    const attributions: PcafAttribution[] = [];

    const coverage = computeGrossExposureCoverage(loans, attributions);

    expect(coverage.excludedAssetTypes).toEqual(["uncategorized"]);
  });

  it("excludes only categories with zero attributions (mixed portfolio)", () => {
    const loans = [
      makeLoan({ id: "l-1", category: "commercial-term-loan" }),
      makeLoan({ id: "l-2", category: "commercial-term-loan" }),
      makeLoan({ id: "l-3", category: "retail-mortgage" }),
      makeLoan({ id: "l-4", category: "retail-personal" }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1" }),
      makeAttribution({ loanId: "l-2" }),
      // retail loans have no attributions
    ];

    const coverage = computeGrossExposureCoverage(loans, attributions);

    // Commercial is included (has 2 attributions)
    // Retail mortgage and personal are excluded (no attributions)
    expect(coverage.excludedAssetTypes).toEqual([
      "Retail mortgages",
      "Retail personal loans",
    ]);
  });

  it("returns sorted excluded asset types", () => {
    const loans = [
      makeLoan({ id: "l-1", category: "commercial-term-loan" }),
      makeLoan({ id: "l-2", category: "retail-vehicle" }),
      makeLoan({ id: "l-3", category: "retail-education" }),
      makeLoan({ id: "l-4", category: "sme-working-capital" }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1" }),
    ];

    const coverage = computeGrossExposureCoverage(loans, attributions);

    // Should be alphabetically sorted
    expect(coverage.excludedAssetTypes).toEqual([
      "Retail education loans",
      "Retail vehicle loans",
      "SME working capital",
    ]);
  });
});

// ---------------------------------------------------------------------------
// N1.2 correction — correct denominator (total, not in-scope)
// ---------------------------------------------------------------------------

describe("computeGrossExposureCoverage — N1.2 correction", () => {
  it("uses total gross exposure as denominator, not in-scope exposure", () => {
    // Portfolio: 80k retail (excluded) + 20k commercial (included)
    // Old calculation: 20k / 20k = 100% (wrong — excludes retail from denominator)
    // New calculation: 20k / 100k = 20% (correct — retail is in denominator)
    const loans = [
      ...Array.from({ length: 8 }, (_, i) =>
        makeLoan({ id: `retail-${i}`, category: "retail-mortgage", outstandingUsd: 10_000, lossAllowance: 0 }),
      ),
      ...Array.from({ length: 2 }, (_, i) =>
        makeLoan({ id: `commercial-${i}`, category: "commercial-term-loan", outstandingUsd: 10_000, lossAllowance: 0 }),
      ),
    ];
    const attributions = [
      makeAttribution({ loanId: "commercial-0" }),
      makeAttribution({ loanId: "commercial-1" }),
    ];

    const coverage = computeGrossExposureCoverage(loans, attributions);

    // Total gross = 10k × 10 = 100k
    // Included gross = 10k × 2 = 20k
    // Coverage = 20% (NOT 100%)
    expect(coverage.totalGrossExposureUsd).toBe(100_000);
    expect(coverage.includedGrossExposureUsd).toBe(20_000);
    expect(coverage.coveragePercent).toBe(20.0);
    expect(coverage.includedLoanCount).toBe(2);
    expect(coverage.excludedLoanCount).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// computeGrossExposureCoverage — N1.3 risk mitigant exclusion
// ---------------------------------------------------------------------------

describe("computeGrossExposureCoverage — N1.3 risk mitigant exclusion", () => {
  it("sets riskMitigantsExcluded to true when any loan has risk mitigants", () => {
    const loans = [
      makeLoan({ id: "l-1", outstandingUsd: 10_000, riskMitigantValueUsd: 2_000 }),
      makeLoan({ id: "l-2", outstandingUsd: 5_000, riskMitigantValueUsd: 0 }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1" }),
      makeAttribution({ loanId: "l-2" }),
    ];

    const coverage = computeGrossExposureCoverage(loans, attributions);

    expect(coverage.riskMitigantsExcluded).toBe(true);
    expect(coverage.totalRiskMitigantValueUsd).toBe(2_000);
  });

  it("sets riskMitigantsExcluded to false when no loans have risk mitigants", () => {
    const loans = [
      makeLoan({ id: "l-1", outstandingUsd: 10_000, riskMitigantValueUsd: undefined }),
      makeLoan({ id: "l-2", outstandingUsd: 5_000, riskMitigantValueUsd: 0 }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1" }),
      makeAttribution({ loanId: "l-2" }),
    ];

    const coverage = computeGrossExposureCoverage(loans, attributions);

    expect(coverage.riskMitigantsExcluded).toBe(false);
    expect(coverage.totalRiskMitigantValueUsd).toBe(0);
  });

  it("accumulates risk mitigant values across all loans", () => {
    const loans = [
      makeLoan({ id: "l-1", outstandingUsd: 10_000, riskMitigantValueUsd: 2_000 }),
      makeLoan({ id: "l-2", outstandingUsd: 8_000, riskMitigantValueUsd: 1_500 }),
      makeLoan({ id: "l-3", outstandingUsd: 6_000, riskMitigantValueUsd: 500 }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1" }),
      makeAttribution({ loanId: "l-2" }),
      makeAttribution({ loanId: "l-3" }),
    ];

    const coverage = computeGrossExposureCoverage(loans, attributions);

    expect(coverage.totalRiskMitigantValueUsd).toBe(4_000);
    expect(coverage.riskMitigantsExcluded).toBe(true);
  });

  it("reduces gross exposure when risk mitigants present", () => {
    // Loan 1: 10k + 200 - 3k = 7,200 gross
    // Loan 2: 5k + 100 - 0 = 5,100 gross
    // Total gross = 12,300 (not 15,300)
    const loans = [
      makeLoan({ id: "l-1", outstandingUsd: 10_000, lossAllowance: 200, riskMitigantValueUsd: 3_000 }),
      makeLoan({ id: "l-2", outstandingUsd: 5_000, lossAllowance: 100, riskMitigantValueUsd: 0 }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1" }),
      makeAttribution({ loanId: "l-2" }),
    ];

    const coverage = computeGrossExposureCoverage(loans, attributions);

    expect(coverage.totalGrossExposureUsd).toBe(12_300);
    expect(coverage.includedGrossExposureUsd).toBe(12_300);
    expect(coverage.riskMitigantsExcluded).toBe(true);
    expect(coverage.totalRiskMitigantValueUsd).toBe(3_000);
  });

  it("handles empty portfolio with risk mitigants correctly", () => {
    const coverage = computeGrossExposureCoverage([], []);

    expect(coverage.riskMitigantsExcluded).toBe(false);
    expect(coverage.totalRiskMitigantValueUsd).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeGrossExposureCoverage — N1.4 undrawn commitment tracking
// ---------------------------------------------------------------------------

describe("computeGrossExposureCoverage — N1.4 undrawn commitment tracking", () => {
  it("tracks undrawn commitments and calculates percentage correctly", () => {
    // Portfolio: 10k drawn + 2k undrawn → 16.67% undrawn
    const loans = [
      makeLoan({ id: "l-1", outstandingUsd: 10_000, lossAllowance: 0, undrawnCommitmentUsd: 2_000 }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1" }),
    ];

    const coverage = computeGrossExposureCoverage(loans, attributions);

    // Total commitment = 10k (drawn) + 2k (undrawn) = 12k
    // Percentage undrawn = 2k / 12k = 16.67%
    expect(coverage.totalUndrawnCommitmentUsd).toBe(2_000);
    expect(coverage.percentageUndrawn).toBe(16.67);
    expect(coverage.undrawnCommitmentsIncluded).toBe(false); // Always false per B62(b)
  });

  it("sets undrawnCommitmentsIncluded to false always (B62(b) funded carrying amount)", () => {
    const loans = [
      makeLoan({ id: "l-1", outstandingUsd: 10_000, undrawnCommitmentUsd: 5_000 }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1" }),
    ];

    const coverage = computeGrossExposureCoverage(loans, attributions);

    // Undrawn are NEVER included in gross exposure (unfunded)
    expect(coverage.undrawnCommitmentsIncluded).toBe(false);
  });

  it("accumulates undrawn commitments across multiple loans", () => {
    const loans = [
      makeLoan({ id: "l-1", outstandingUsd: 10_000, lossAllowance: 0, undrawnCommitmentUsd: 2_000 }),
      makeLoan({ id: "l-2", outstandingUsd: 8_000, lossAllowance: 0, undrawnCommitmentUsd: 1_500 }),
      makeLoan({ id: "l-3", outstandingUsd: 6_000, lossAllowance: 0, undrawnCommitmentUsd: 500 }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1" }),
      makeAttribution({ loanId: "l-2" }),
      makeAttribution({ loanId: "l-3" }),
    ];

    const coverage = computeGrossExposureCoverage(loans, attributions);

    expect(coverage.totalUndrawnCommitmentUsd).toBe(4_000); // 2k + 1.5k + 0.5k
    // Total commitment = 24k (drawn) + 4k (undrawn) = 28k
    // Percentage undrawn = 4k / 28k = 14.29%
    expect(coverage.percentageUndrawn).toBe(14.29);
  });

  it("handles portfolio with no undrawn commitments (0% undrawn)", () => {
    const loans = [
      makeLoan({ id: "l-1", outstandingUsd: 10_000, lossAllowance: 0, undrawnCommitmentUsd: undefined }),
      makeLoan({ id: "l-2", outstandingUsd: 5_000, lossAllowance: 0, undrawnCommitmentUsd: 0 }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1" }),
      makeAttribution({ loanId: "l-2" }),
    ];

    const coverage = computeGrossExposureCoverage(loans, attributions);

    expect(coverage.totalUndrawnCommitmentUsd).toBe(0);
    expect(coverage.percentageUndrawn).toBe(0);
    expect(coverage.undrawnCommitmentsIncluded).toBe(false);
  });

  it("calculates percentage correctly when risk mitigants present", () => {
    // Loan 1: 10k + 200 - 3k (mitigant) = 7,200 gross exposure
    // Loan 1 undrawn: 2k
    // Total commitment = (10k + 200) gross before mitigant + 2k undrawn = 12,200
    // Percentage undrawn = 2k / 12,200 = 16.39%
    const loans = [
      makeLoan({
        id: "l-1",
        outstandingUsd: 10_000,
        lossAllowance: 200,
        riskMitigantValueUsd: 3_000,
        undrawnCommitmentUsd: 2_000,
      }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1" }),
    ];

    const coverage = computeGrossExposureCoverage(loans, attributions);

    // Gross exposure includes mitigant subtraction: 10,200 - 3,000 = 7,200
    expect(coverage.totalGrossExposureUsd).toBe(7_200);
    // But percentage undrawn uses gross BEFORE mitigant: (10,200) + 2,000 = 12,200
    expect(coverage.totalUndrawnCommitmentUsd).toBe(2_000);
    expect(coverage.percentageUndrawn).toBe(16.39);
  });

  it("handles empty portfolio with undrawn commitments correctly", () => {
    const coverage = computeGrossExposureCoverage([], []);

    expect(coverage.undrawnCommitmentsIncluded).toBe(false);
    expect(coverage.totalUndrawnCommitmentUsd).toBe(0);
    expect(coverage.percentageUndrawn).toBe(0);
  });

  it("handles portfolio where all commitment is undrawn (100% undrawn)", () => {
    // Loan with zero drawn (unusual but possible: approved but not yet disbursed)
    const loans = [
      makeLoan({ id: "l-1", outstandingUsd: 0, lossAllowance: 0, undrawnCommitmentUsd: 5_000 }),
    ];
    // No attribution since nothing is drawn/funded
    const attributions: PcafAttribution[] = [];

    const coverage = computeGrossExposureCoverage(loans, attributions);

    expect(coverage.totalGrossExposureUsd).toBe(0);
    expect(coverage.totalUndrawnCommitmentUsd).toBe(5_000);
    // Total commitment = 0 + 5k = 5k; 5k / 5k = 100%
    expect(coverage.percentageUndrawn).toBe(100.0);
  });
});
