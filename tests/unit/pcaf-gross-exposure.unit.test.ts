/**
 * UNIT TESTS — IFRS S2 B62(b) gross exposure computation.
 * jana-bfi-app · PR1 task N1.1 of PROJECT_PLAN.md (TEST_STRATEGY §4.1, Tier 1).
 *
 * SCOPE
 * -----
 *   • lib/regulatory/pcaf/gross-exposure.ts — IFRS S2 B62(b) funded carrying
 *     amount before loss allowance, industry × asset-class disaggregation.
 *
 * WHY
 * ---
 * `grossExposureUsd()` is the single source of truth for the B62(b) disclosure
 * formula (outstanding + loss allowance). `computeGrossExposureMatrix()` builds
 * the required industry × asset-class disaggregation. These functions drive the
 * annual NFRS/ISSB climate disclosures and must produce stable, auditable
 * numbers — so this test pins the arithmetic and exercises the edge cases
 * (loans without loss allowance, orphaned loans, empty portfolios).
 */
import { describe, expect, it } from "vitest";
import {
  IFRS_S2_B62_CITATION,
  grossExposureUsd,
  computeGrossExposureMatrix,
} from "@/lib/regulatory/pcaf/gross-exposure";
import type { Borrower, Loan, PcafAttribution } from "@/lib/types/bfi";

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
    lossAllowance: 150, // 2% provision (typical Nepal BFI)
    disbursedDate: "2024-01-15",
    maturityDate: "2029-01-15",
    status: "active",
    nrbTaxonomy: "unclassified",
    purpose: "Working capital",
    ...overrides,
  };
}

function makeBorrower(overrides: Partial<Borrower> = {}): Borrower {
  return {
    id: "b-1",
    name: "Test Borrower Pvt. Ltd.",
    kind: "corporate",
    nrbSector: "Manufacturing - Cement",
    enterpriseValueUsd: 10_000_000,
    evSource: "estimated",
    dataTier: "sector-benchmark",
    publiclyListed: false,
    facilities: [],
    totalCo2eTonnes: 100_000,
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
// grossExposureUsd()
// ---------------------------------------------------------------------------

describe("grossExposureUsd", () => {
  it("is outstanding USD + loss allowance per IFRS S2 B62(b)", () => {
    const loan = makeLoan({ outstandingUsd: 10_000, lossAllowance: 200 });
    expect(grossExposureUsd(loan)).toBe(10_200);
  });

  it("falls back to outstanding USD when lossAllowance is undefined", () => {
    const loan = makeLoan({ outstandingUsd: 10_000, lossAllowance: undefined });
    expect(grossExposureUsd(loan)).toBe(10_000);
  });

  it("treats zero lossAllowance as zero, not undefined", () => {
    const loan = makeLoan({ outstandingUsd: 10_000, lossAllowance: 0 });
    expect(grossExposureUsd(loan)).toBe(10_000);
  });

  it("exposes an IFRS S2 B62(b) citation string", () => {
    expect(IFRS_S2_B62_CITATION).toContain("IFRS S2");
    expect(IFRS_S2_B62_CITATION).toContain("B62(b)");
  });
});

// ---------------------------------------------------------------------------
// computeGrossExposureMatrix() — happy path
// ---------------------------------------------------------------------------

describe("computeGrossExposureMatrix — happy path", () => {
  it("aggregates gross exposure by industry × asset class", () => {
    const borrower = makeBorrower({ id: "b-1", nrbSector: "Manufacturing - Cement" });
    const loans = [
      makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 10_000, lossAllowance: 200 }),
      makeLoan({ id: "l-2", borrowerId: "b-1", outstandingUsd: 5_000, lossAllowance: 100 }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1", borrowerId: "b-1", pcafAssetClass: "business-loans-unlisted-equity", attributedCo2eTonnes: 50 }),
      makeAttribution({ loanId: "l-2", borrowerId: "b-1", pcafAssetClass: "business-loans-unlisted-equity", attributedCo2eTonnes: 30 }),
    ];

    const matrix = computeGrossExposureMatrix(loans, [borrower], attributions);

    expect(matrix).toHaveLength(1);
    expect(matrix[0]).toMatchObject({
      industry: "Manufacturing - Cement",
      assetClass: "business-loans-unlisted-equity",
      grossExposureUsd: 10_200 + 5_100, // (10k + 200) + (5k + 100)
      loanCount: 2,
      attributedCo2eTonnes: 80, // 50 + 30
    });
  });

  it("creates separate cells for different industries", () => {
    const borrowers = [
      makeBorrower({ id: "b-1", nrbSector: "Manufacturing - Cement" }),
      makeBorrower({ id: "b-2", nrbSector: "Energy - Hydropower" }),
    ];
    const loans = [
      makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 10_000, lossAllowance: 200 }),
      makeLoan({ id: "l-2", borrowerId: "b-2", outstandingUsd: 5_000, lossAllowance: 100 }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1", borrowerId: "b-1", pcafAssetClass: "business-loans-unlisted-equity" }),
      makeAttribution({ loanId: "l-2", borrowerId: "b-2", pcafAssetClass: "business-loans-unlisted-equity" }),
    ];

    const matrix = computeGrossExposureMatrix(loans, borrowers, attributions);

    expect(matrix).toHaveLength(2);
    expect(matrix.find((c) => c.industry === "Manufacturing - Cement")).toBeDefined();
    expect(matrix.find((c) => c.industry === "Energy - Hydropower")).toBeDefined();
  });

  it("creates separate cells for different asset classes", () => {
    const borrower = makeBorrower({ id: "b-1", nrbSector: "Manufacturing - Cement" });
    const loans = [
      makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 10_000 }),
      makeLoan({ id: "l-2", borrowerId: "b-1", outstandingUsd: 5_000 }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1", borrowerId: "b-1", pcafAssetClass: "business-loans-unlisted-equity" }),
      makeAttribution({ loanId: "l-2", borrowerId: "b-1", pcafAssetClass: "project-finance" }),
    ];

    const matrix = computeGrossExposureMatrix(loans, [borrower], attributions);

    expect(matrix).toHaveLength(2);
    expect(matrix.find((c) => c.assetClass === "business-loans-unlisted-equity")).toBeDefined();
    expect(matrix.find((c) => c.assetClass === "project-finance")).toBeDefined();
  });

  it("sorts cells by descending gross exposure", () => {
    const borrower = makeBorrower({ id: "b-1", nrbSector: "Manufacturing - Cement" });
    const loans = [
      makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 1_000 }),
      makeLoan({ id: "l-2", borrowerId: "b-1", outstandingUsd: 10_000 }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1", borrowerId: "b-1", pcafAssetClass: "business-loans-unlisted-equity" }),
      makeAttribution({ loanId: "l-2", borrowerId: "b-1", pcafAssetClass: "project-finance" }),
    ];

    const matrix = computeGrossExposureMatrix(loans, [borrower], attributions);

    // Largest exposure first
    expect(matrix[0].grossExposureUsd).toBeGreaterThan(matrix[1].grossExposureUsd);
  });
});

// ---------------------------------------------------------------------------
// computeGrossExposureMatrix() — edge cases & defensive fallbacks
// ---------------------------------------------------------------------------

describe("computeGrossExposureMatrix — edge cases", () => {
  it("returns empty matrix for empty portfolio", () => {
    const matrix = computeGrossExposureMatrix([], [], []);
    expect(matrix).toEqual([]);
  });

  it("skips loans with no attribution (out-of-scope retail)", () => {
    const borrower = makeBorrower({ id: "b-1", kind: "retail-pool", nrbSector: "Retail" });
    const loans = [makeLoan({ id: "l-1", borrowerId: "b-1", category: "retail-mortgage" })];
    // No attribution for this loan → should be skipped
    const matrix = computeGrossExposureMatrix(loans, [borrower], []);
    expect(matrix).toEqual([]);
  });

  it("skips loans with attribution but missing pcafAssetClass", () => {
    const borrower = makeBorrower({ id: "b-1" });
    const loans = [makeLoan({ id: "l-1", borrowerId: "b-1" })];
    const attributions = [makeAttribution({ loanId: "l-1", borrowerId: "b-1", pcafAssetClass: undefined })];

    const matrix = computeGrossExposureMatrix(loans, [borrower], attributions);
    expect(matrix).toEqual([]);
  });

  it("skips orphaned loans (borrower missing from borrowers array)", () => {
    const loans = [makeLoan({ id: "l-1", borrowerId: "ghost" })];
    const attributions = [makeAttribution({ loanId: "l-1", borrowerId: "ghost" })];

    const matrix = computeGrossExposureMatrix(loans, [], attributions);
    expect(matrix).toEqual([]);
  });

  it("includes loans with undefined lossAllowance (uses outstandingUsd only)", () => {
    const borrower = makeBorrower({ id: "b-1", nrbSector: "Manufacturing - Cement" });
    const loans = [makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 10_000, lossAllowance: undefined })];
    const attributions = [makeAttribution({ loanId: "l-1", borrowerId: "b-1" })];

    const matrix = computeGrossExposureMatrix(loans, [borrower], attributions);

    expect(matrix).toHaveLength(1);
    expect(matrix[0].grossExposureUsd).toBe(10_000); // No loss allowance to add
  });

  it("accumulates multiple loans in the same cell (Map.get hit branch)", () => {
    const borrower = makeBorrower({ id: "b-1", nrbSector: "Manufacturing - Cement" });
    const loans = [
      makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 1_000, lossAllowance: 20 }),
      makeLoan({ id: "l-2", borrowerId: "b-1", outstandingUsd: 2_000, lossAllowance: 40 }),
      makeLoan({ id: "l-3", borrowerId: "b-1", outstandingUsd: 3_000, lossAllowance: 60 }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1", borrowerId: "b-1", pcafAssetClass: "business-loans-unlisted-equity", attributedCo2eTonnes: 10 }),
      makeAttribution({ loanId: "l-2", borrowerId: "b-1", pcafAssetClass: "business-loans-unlisted-equity", attributedCo2eTonnes: 20 }),
      makeAttribution({ loanId: "l-3", borrowerId: "b-1", pcafAssetClass: "business-loans-unlisted-equity", attributedCo2eTonnes: 30 }),
    ];

    const matrix = computeGrossExposureMatrix(loans, [borrower], attributions);

    expect(matrix).toHaveLength(1);
    expect(matrix[0]).toMatchObject({
      grossExposureUsd: (1_000 + 20) + (2_000 + 40) + (3_000 + 60),
      loanCount: 3,
      attributedCo2eTonnes: 60,
    });
  });

  it("handles mixed industries and asset classes (full 2×2 matrix)", () => {
    const borrowers = [
      makeBorrower({ id: "b-1", nrbSector: "Manufacturing - Cement" }),
      makeBorrower({ id: "b-2", nrbSector: "Energy - Hydropower" }),
    ];
    const loans = [
      makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 10_000 }),
      makeLoan({ id: "l-2", borrowerId: "b-1", outstandingUsd: 5_000 }),
      makeLoan({ id: "l-3", borrowerId: "b-2", outstandingUsd: 8_000 }),
      makeLoan({ id: "l-4", borrowerId: "b-2", outstandingUsd: 3_000 }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1", borrowerId: "b-1", pcafAssetClass: "business-loans-unlisted-equity" }),
      makeAttribution({ loanId: "l-2", borrowerId: "b-1", pcafAssetClass: "project-finance" }),
      makeAttribution({ loanId: "l-3", borrowerId: "b-2", pcafAssetClass: "business-loans-unlisted-equity" }),
      makeAttribution({ loanId: "l-4", borrowerId: "b-2", pcafAssetClass: "project-finance" }),
    ];

    const matrix = computeGrossExposureMatrix(loans, borrowers, attributions);

    // 2 industries × 2 asset classes = 4 cells
    expect(matrix).toHaveLength(4);
    expect(matrix.find((c) => c.industry === "Manufacturing - Cement" && c.assetClass === "business-loans-unlisted-equity")).toBeDefined();
    expect(matrix.find((c) => c.industry === "Manufacturing - Cement" && c.assetClass === "project-finance")).toBeDefined();
    expect(matrix.find((c) => c.industry === "Energy - Hydropower" && c.assetClass === "business-loans-unlisted-equity")).toBeDefined();
    expect(matrix.find((c) => c.industry === "Energy - Hydropower" && c.assetClass === "project-finance")).toBeDefined();
  });
});
