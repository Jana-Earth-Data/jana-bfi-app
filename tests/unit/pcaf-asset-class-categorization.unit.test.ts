/**
 * UNIT TESTS — PCAF asset class categorization (N1.8).
 * jana-bfi-app · PR1 task N1.8 of PROJECT_PLAN.md (TEST_STRATEGY §4.1, Tier 1).
 *
 * SCOPE
 * -----
 *   • lib/regulatory/pcaf/types.ts — Asset class categorization helpers added
 *     for N1.8: LOAN_ORIGINATION_ASSET_CLASSES, INVESTMENT_PORTFOLIO_ASSET_CLASSES,
 *     isSupportedForLoanOrigination(), isInvestmentPortfolioClass()
 *   • lib/regulatory/pcaf/scoring.ts — assetClassForLoanCategory() routing and
 *     computePcafScore() validation updated for N1.8
 *
 * WHY
 * ---
 * Per NFRS_REMEDIATION_BACKLOG.md N1.8, IFRS S2 B62(a)(ii) and PCAF §5 require
 * disclosure of which asset classes are included in financed emissions calculation.
 * Ten PCAF asset classes are declared in the type system, but only five apply to
 * **loan origination** portfolios (the lending book). The other five are
 * **investment portfolio** classes (equity/bond holdings, sovereign debt) that
 * require separate calculation logic per PCAF Part A §5.1, §5.7–§5.10.
 *
 * These tests verify that the categorization is explicit, complete, and enforced:
 * 1. Every PCAF asset class is in exactly one category (loan origination XOR investment)
 * 2. The router (assetClassForLoanCategory) only returns loan-origination classes
 * 3. Validation in computePcafScore rejects unsupported (investment) classes
 * 4. The categorization helpers (isSupportedForLoanOrigination, isInvestmentPortfolioClass)
 *    correctly identify which category each class belongs to
 */
import { describe, expect, it } from "vitest";
import {
  LOAN_ORIGINATION_ASSET_CLASSES,
  INVESTMENT_PORTFOLIO_ASSET_CLASSES,
  isSupportedForLoanOrigination,
  isInvestmentPortfolioClass,
  type PcafAssetClass,
} from "@/lib/regulatory/pcaf/types";
import {
  assetClassForLoanCategory,
  computePcafScore,
} from "@/lib/regulatory/pcaf/scoring";
import type { Borrower, Loan, LoanCategory } from "@/lib/types/bfi";

// ---------------------------------------------------------------------------
// Minimal fixtures
// ---------------------------------------------------------------------------

function makeLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: "test-loan",
    borrowerId: "test-borrower",
    product: "Term Loan",
    category: "commercial-term-loan",
    outstandingNpr: 13_350_000, // 100k USD @ 133.5 NPR/USD
    outstandingUsd: 100_000,
    disbursedDate: "2024-01-15",
    maturityDate: "2029-01-15",
    status: "disbursed",
    nrbTaxonomy: "unclassified",
    purpose: "General corporate",
    ...overrides,
  };
}

function makeBorrower(overrides: Partial<Borrower> = {}): Borrower {
  return {
    id: "test-borrower",
    name: "Test Borrower",
    kind: "corporate",
    nrbSector: "Manufacturing - Other",
    enterpriseValueUsd: 1_000_000,
    evSource: "estimated",
    dataTier: "sector-benchmark",
    publiclyListed: false,
    totalCo2eTonnes: 5000,
    facilities: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Asset class categorization — set membership
// ---------------------------------------------------------------------------

describe("LOAN_ORIGINATION_ASSET_CLASSES — contains exactly the 5 supported classes", () => {
  it("includes all five loan origination classes", () => {
    expect(LOAN_ORIGINATION_ASSET_CLASSES.has("business-loans-unlisted-equity")).toBe(
      true
    );
    expect(LOAN_ORIGINATION_ASSET_CLASSES.has("project-finance")).toBe(true);
    expect(LOAN_ORIGINATION_ASSET_CLASSES.has("mortgages")).toBe(true);
    expect(LOAN_ORIGINATION_ASSET_CLASSES.has("motor-vehicle-loans")).toBe(true);
    expect(LOAN_ORIGINATION_ASSET_CLASSES.has("out-of-scope")).toBe(true);
  });

  it("has exactly 5 members", () => {
    expect(LOAN_ORIGINATION_ASSET_CLASSES.size).toBe(5);
  });

  it("does not include any investment portfolio classes", () => {
    expect(LOAN_ORIGINATION_ASSET_CLASSES.has("listed-equity-corporate-bonds")).toBe(
      false
    );
    expect(LOAN_ORIGINATION_ASSET_CLASSES.has("commercial-real-estate")).toBe(false);
    expect(LOAN_ORIGINATION_ASSET_CLASSES.has("use-of-proceeds-structures")).toBe(
      false
    );
    expect(
      LOAN_ORIGINATION_ASSET_CLASSES.has("securitisation-structured-products")
    ).toBe(false);
    expect(LOAN_ORIGINATION_ASSET_CLASSES.has("sovereign-debt")).toBe(false);
    expect(LOAN_ORIGINATION_ASSET_CLASSES.has("sub-sovereign-debt")).toBe(false);
  });
});

describe("INVESTMENT_PORTFOLIO_ASSET_CLASSES — contains exactly the 6 unsupported classes", () => {
  it("includes all six investment portfolio classes", () => {
    expect(
      INVESTMENT_PORTFOLIO_ASSET_CLASSES.has("listed-equity-corporate-bonds")
    ).toBe(true);
    expect(INVESTMENT_PORTFOLIO_ASSET_CLASSES.has("commercial-real-estate")).toBe(
      true
    );
    expect(INVESTMENT_PORTFOLIO_ASSET_CLASSES.has("use-of-proceeds-structures")).toBe(
      true
    );
    expect(
      INVESTMENT_PORTFOLIO_ASSET_CLASSES.has("securitisation-structured-products")
    ).toBe(true);
    expect(INVESTMENT_PORTFOLIO_ASSET_CLASSES.has("sovereign-debt")).toBe(true);
    expect(INVESTMENT_PORTFOLIO_ASSET_CLASSES.has("sub-sovereign-debt")).toBe(true);
  });

  it("has exactly 6 members", () => {
    expect(INVESTMENT_PORTFOLIO_ASSET_CLASSES.size).toBe(6);
  });

  it("does not include any loan origination classes", () => {
    expect(
      INVESTMENT_PORTFOLIO_ASSET_CLASSES.has("business-loans-unlisted-equity")
    ).toBe(false);
    expect(INVESTMENT_PORTFOLIO_ASSET_CLASSES.has("project-finance")).toBe(false);
    expect(INVESTMENT_PORTFOLIO_ASSET_CLASSES.has("mortgages")).toBe(false);
    expect(INVESTMENT_PORTFOLIO_ASSET_CLASSES.has("motor-vehicle-loans")).toBe(
      false
    );
    expect(INVESTMENT_PORTFOLIO_ASSET_CLASSES.has("out-of-scope")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Asset class categorization — every class is in exactly one category
// ---------------------------------------------------------------------------

describe("Asset class categorization — complete and exclusive", () => {
  // All 11 PCAF asset classes per types.ts PcafAssetClass union
  const allAssetClasses: PcafAssetClass[] = [
    "business-loans-unlisted-equity",
    "project-finance",
    "mortgages",
    "motor-vehicle-loans",
    "listed-equity-corporate-bonds",
    "commercial-real-estate",
    "use-of-proceeds-structures",
    "securitisation-structured-products",
    "sovereign-debt",
    "sub-sovereign-debt",
    "out-of-scope",
  ];

  it("every PCAF asset class is in exactly one category (XOR)", () => {
    allAssetClasses.forEach((ac) => {
      const isLoan = LOAN_ORIGINATION_ASSET_CLASSES.has(ac);
      const isInvestment = INVESTMENT_PORTFOLIO_ASSET_CLASSES.has(ac);
      // XOR: exactly one must be true
      expect(isLoan !== isInvestment).toBe(true);
      // Explicit message for clarity
      if (!isLoan && !isInvestment) {
        throw new Error(`Asset class "${ac}" is in neither category`);
      }
      if (isLoan && isInvestment) {
        throw new Error(`Asset class "${ac}" is in both categories`);
      }
    });
  });

  it("total members across both sets equals 11 (all PCAF classes)", () => {
    const totalMembers =
      LOAN_ORIGINATION_ASSET_CLASSES.size + INVESTMENT_PORTFOLIO_ASSET_CLASSES.size;
    expect(totalMembers).toBe(11);
  });
});

// ---------------------------------------------------------------------------
// isSupportedForLoanOrigination() helper
// ---------------------------------------------------------------------------

describe("isSupportedForLoanOrigination · returns true for loan origination classes", () => {
  it("business-loans-unlisted-equity → true", () => {
    expect(isSupportedForLoanOrigination("business-loans-unlisted-equity")).toBe(
      true
    );
  });

  it("project-finance → true", () => {
    expect(isSupportedForLoanOrigination("project-finance")).toBe(true);
  });

  it("mortgages → true", () => {
    expect(isSupportedForLoanOrigination("mortgages")).toBe(true);
  });

  it("motor-vehicle-loans → true", () => {
    expect(isSupportedForLoanOrigination("motor-vehicle-loans")).toBe(true);
  });

  it("out-of-scope → true", () => {
    expect(isSupportedForLoanOrigination("out-of-scope")).toBe(true);
  });
});

describe("isSupportedForLoanOrigination · returns false for investment portfolio classes", () => {
  it("listed-equity-corporate-bonds → false", () => {
    expect(isSupportedForLoanOrigination("listed-equity-corporate-bonds")).toBe(
      false
    );
  });

  it("commercial-real-estate → false", () => {
    expect(isSupportedForLoanOrigination("commercial-real-estate")).toBe(false);
  });

  it("use-of-proceeds-structures → false", () => {
    expect(isSupportedForLoanOrigination("use-of-proceeds-structures")).toBe(false);
  });

  it("securitisation-structured-products → false", () => {
    expect(isSupportedForLoanOrigination("securitisation-structured-products")).toBe(
      false
    );
  });

  it("sovereign-debt → false", () => {
    expect(isSupportedForLoanOrigination("sovereign-debt")).toBe(false);
  });

  it("sub-sovereign-debt → false", () => {
    expect(isSupportedForLoanOrigination("sub-sovereign-debt")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isInvestmentPortfolioClass() helper
// ---------------------------------------------------------------------------

describe("isInvestmentPortfolioClass · returns true for investment portfolio classes", () => {
  it("listed-equity-corporate-bonds → true", () => {
    expect(isInvestmentPortfolioClass("listed-equity-corporate-bonds")).toBe(true);
  });

  it("commercial-real-estate → true", () => {
    expect(isInvestmentPortfolioClass("commercial-real-estate")).toBe(true);
  });

  it("use-of-proceeds-structures → true", () => {
    expect(isInvestmentPortfolioClass("use-of-proceeds-structures")).toBe(true);
  });

  it("securitisation-structured-products → true", () => {
    expect(isInvestmentPortfolioClass("securitisation-structured-products")).toBe(
      true
    );
  });

  it("sovereign-debt → true", () => {
    expect(isInvestmentPortfolioClass("sovereign-debt")).toBe(true);
  });

  it("sub-sovereign-debt → true", () => {
    expect(isInvestmentPortfolioClass("sub-sovereign-debt")).toBe(true);
  });
});

describe("isInvestmentPortfolioClass · returns false for loan origination classes", () => {
  it("business-loans-unlisted-equity → false", () => {
    expect(isInvestmentPortfolioClass("business-loans-unlisted-equity")).toBe(false);
  });

  it("project-finance → false", () => {
    expect(isInvestmentPortfolioClass("project-finance")).toBe(false);
  });

  it("mortgages → false", () => {
    expect(isInvestmentPortfolioClass("mortgages")).toBe(false);
  });

  it("motor-vehicle-loans → false", () => {
    expect(isInvestmentPortfolioClass("motor-vehicle-loans")).toBe(false);
  });

  it("out-of-scope → false", () => {
    expect(isInvestmentPortfolioClass("out-of-scope")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// assetClassForLoanCategory() — never returns unsupported classes
// ---------------------------------------------------------------------------

describe("assetClassForLoanCategory · never returns unsupported classes (N1.8)", () => {
  // All 12 LoanCategory values per types.ts
  const allLoanCategories: Array<LoanCategory | undefined> = [
    "retail-mortgage",
    "retail-personal",
    "retail-education",
    "retail-vehicle",
    "sme-working-capital",
    "sme-trade-finance",
    "sme-term-loan",
    "commercial-term-loan",
    "commercial-working-capital",
    "commercial-project-finance",
    "corporate-syndicated",
    "corporate-project-finance",
    undefined, // Test undefined case
  ];

  it("every LoanCategory routes to a loan-origination-supported class", () => {
    allLoanCategories.forEach((category) => {
      const assetClass = assetClassForLoanCategory(category);
      expect(isSupportedForLoanOrigination(assetClass)).toBe(true);
      expect(isInvestmentPortfolioClass(assetClass)).toBe(false);
    });
  });

  it("no LoanCategory routes to listed-equity-corporate-bonds", () => {
    allLoanCategories.forEach((category) => {
      expect(assetClassForLoanCategory(category)).not.toBe(
        "listed-equity-corporate-bonds"
      );
    });
  });

  it("no LoanCategory routes to commercial-real-estate", () => {
    allLoanCategories.forEach((category) => {
      expect(assetClassForLoanCategory(category)).not.toBe("commercial-real-estate");
    });
  });

  it("no LoanCategory routes to use-of-proceeds-structures", () => {
    allLoanCategories.forEach((category) => {
      expect(assetClassForLoanCategory(category)).not.toBe(
        "use-of-proceeds-structures"
      );
    });
  });

  it("no LoanCategory routes to securitisation-structured-products", () => {
    allLoanCategories.forEach((category) => {
      expect(assetClassForLoanCategory(category)).not.toBe(
        "securitisation-structured-products"
      );
    });
  });

  it("no LoanCategory routes to sovereign-debt", () => {
    allLoanCategories.forEach((category) => {
      expect(assetClassForLoanCategory(category)).not.toBe("sovereign-debt");
    });
  });

  it("no LoanCategory routes to sub-sovereign-debt", () => {
    allLoanCategories.forEach((category) => {
      expect(assetClassForLoanCategory(category)).not.toBe("sub-sovereign-debt");
    });
  });
});

// ---------------------------------------------------------------------------
// computePcafScore() validation — rejects unsupported asset classes
// ---------------------------------------------------------------------------

describe("computePcafScore · rejects unsupported asset classes (N1.8)", () => {
  const loan = makeLoan();
  const borrower = makeBorrower();
  const availability = {
    borrower_publishes_verified: false,
    borrower_publishes_unverified: false,
    energy_consumption_data_available: false,
    physical_activity_data_available: false,
    revenue_data_available: false,
    sector_average_only: true,
    out_of_scope: false,
  };

  it("throws for listed-equity-corporate-bonds", () => {
    expect(() =>
      computePcafScore(loan, borrower, null, availability, "listed-equity-corporate-bonds")
    ).toThrow(/not supported for loan origination/);
    expect(() =>
      computePcafScore(loan, borrower, null, availability, "listed-equity-corporate-bonds")
    ).toThrow(/investment portfolios/);
  });

  it("throws for commercial-real-estate", () => {
    expect(() =>
      computePcafScore(loan, borrower, null, availability, "commercial-real-estate")
    ).toThrow(/not supported for loan origination/);
  });

  it("throws for use-of-proceeds-structures", () => {
    expect(() =>
      computePcafScore(loan, borrower, null, availability, "use-of-proceeds-structures")
    ).toThrow(/not supported for loan origination/);
  });

  it("throws for securitisation-structured-products", () => {
    expect(() =>
      computePcafScore(loan, borrower, null, availability, "securitisation-structured-products")
    ).toThrow(/not supported for loan origination/);
  });

  it("throws for sovereign-debt", () => {
    expect(() =>
      computePcafScore(loan, borrower, null, availability, "sovereign-debt")
    ).toThrow(/not supported for loan origination/);
  });

  it("throws for sub-sovereign-debt", () => {
    expect(() =>
      computePcafScore(loan, borrower, null, availability, "sub-sovereign-debt")
    ).toThrow(/not supported for loan origination/);
  });

  it("error message includes explanation and remedy", () => {
    expect(() =>
      computePcafScore(loan, borrower, null, availability, "sovereign-debt")
    ).toThrow(/PCAF Part A §5/);
    expect(() =>
      computePcafScore(loan, borrower, null, availability, "sovereign-debt")
    ).toThrow(/isSupportedForLoanOrigination/);
  });
});

describe("computePcafScore · accepts all supported asset classes (N1.8)", () => {
  const loan = makeLoan();
  const borrower = makeBorrower();
  const availability = {
    borrower_publishes_verified: false,
    borrower_publishes_unverified: false,
    energy_consumption_data_available: false,
    physical_activity_data_available: false,
    revenue_data_available: false,
    sector_average_only: true,
    out_of_scope: false,
  };

  it("accepts business-loans-unlisted-equity", () => {
    const result = computePcafScore(
      loan,
      borrower,
      null,
      availability,
      "business-loans-unlisted-equity"
    );
    expect(result.assetClass).toBe("business-loans-unlisted-equity");
  });

  it("accepts project-finance", () => {
    const result = computePcafScore(
      loan,
      borrower,
      null,
      availability,
      "project-finance"
    );
    expect(result.assetClass).toBe("project-finance");
  });

  it("accepts mortgages", () => {
    const result = computePcafScore(loan, borrower, null, availability, "mortgages");
    expect(result.assetClass).toBe("mortgages");
  });

  it("accepts motor-vehicle-loans", () => {
    const result = computePcafScore(
      loan,
      borrower,
      null,
      availability,
      "motor-vehicle-loans"
    );
    expect(result.assetClass).toBe("motor-vehicle-loans");
  });

  it("accepts out-of-scope", () => {
    const outOfScopeAvailability = { ...availability, out_of_scope: true };
    const result = computePcafScore(
      loan,
      borrower,
      null,
      outOfScopeAvailability,
      "out-of-scope"
    );
    expect(result.assetClass).toBe("out-of-scope");
  });
});
