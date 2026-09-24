/**
 * UNIT TESTS — PCAF per-loan data-quality scoring.
 * jana-bfi-app · P1.1 of PROJECT_PLAN.md (TEST_STRATEGY §4.1, Tier 1).
 *
 * SCOPE
 * -----
 * `lib/regulatory/pcaf/scoring.ts` — the pure §5 decision tree that turns a
 * loan + borrower + availability-flag bundle into a PCAF data-quality score
 * (1 best … 5 worst), option letter (1a/1b/2a/2b/3a/3b/3c), method summary,
 * data source, and a paragraph citation an auditor can trace.
 *
 * WHY TABLE-DRIVEN
 * ----------------
 * Per TEST_STRATEGY §4.1, coverage is a floor, not a ceiling: 100% branch
 * coverage proves every branch *ran*, not that every *rule* is right. So each
 * case here is derived from the standard and asserts the SCORE **and** the
 * CITATION (and, for the ladder, the OPTION) — a misread §5 rung fails loudly.
 *
 * These are the public entry points exercised:
 *   • assetClassForLoanCategory()  — LoanCategory → PCAF §5.x asset class
 *   • inferPcafAvailability()      — borrower catalog → availability flags
 *   • resolvePcafAvailability()    — officer override composes over inferred
 *   • computePcafScore()           — the §5 ladder + out-of-scope short-circuit
 *
 * NOTE (for P1.5's 100% gate / P1.7): two branches in scoring.ts are
 * *unreachable* through the public API and are therefore genuinely dead —
 * `chooseOption`'s trailing `default` (LoanCategory is exhaustive) and
 * `methodDescription`'s `case "3c"` (chooseOption never returns "3c"). The
 * Option-3c collapse itself is still asserted via SCORE_FOR_OPTION below.
 */
import {
  assetClassForLoanCategory,
  computePcafScore,
  inferPcafAvailability,
  resolvePcafAvailability,
} from "@/lib/regulatory/pcaf/scoring";
import {
  PCAF_OPTION_LABEL,
  SCORE_FOR_OPTION,
  type PcafAssetClass,
  type PcafDataAvailability,
} from "@/lib/regulatory/pcaf/types";
import type { Borrower, Loan, LoanCategory } from "@/lib/types/bfi";

// ---------------------------------------------------------------------------
// Minimal fixtures — only the fields scoring.ts actually reads.
// ---------------------------------------------------------------------------

function makeBorrower(overrides: Partial<Borrower> = {}): Borrower {
  return {
    id: "b-1",
    name: "Test Borrower Pvt. Ltd.",
    kind: "corporate",
    nrbSector: "Manufacturing",
    enterpriseValueUsd: 10_000_000,
    evSource: "estimated",
    dataTier: "sector-benchmark",
    publiclyListed: false,
    facilities: [],
    totalCo2eTonnes: 0,
    ...overrides,
  };
}

/** A single Climate TRACE / GCCT facility match (only presence matters here). */
function makeFacility(): Borrower["facilities"][number] {
  return {
    assetId: "ct-1",
    facilityName: "Test Facility",
    sector: "manufacturing",
    lat: 27.7,
    lng: 85.3,
    annualCo2eTonnes: 100_000,
    emissionsYear: 2024,
    matchMethod: "manual",
    matchConfidence: 1,
  };
}

function makeLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: "l-1",
    borrowerId: "b-1",
    product: "Term Loan",
    category: "commercial-term-loan",
    outstandingNpr: 1_000_000,
    outstandingUsd: 7_500,
    disbursedDate: "2024-01-15",
    maturityDate: "2029-01-15",
    status: "active",
    nrbTaxonomy: "unclassified",
    purpose: "General corporate",
    ...overrides,
  };
}

/** Fully-false availability bundle; spread with the one flag under test. */
function noFlags(): PcafDataAvailability {
  return {
    borrower_publishes_verified: false,
    borrower_publishes_unverified: false,
    energy_consumption_data_available: false,
    physical_activity_data_available: false,
    revenue_data_available: false,
    sector_average_only: true,
    out_of_scope: false,
  };
}

// ===========================================================================
// assetClassForLoanCategory() — LoanCategory → PCAF §5.x asset class
// ===========================================================================

describe("assetClassForLoanCategory · routing every LoanCategory", () => {
  const cases: Array<[LoanCategory | undefined, PcafAssetClass]> = [
    ["retail-mortgage", "mortgages"],
    ["retail-vehicle", "motor-vehicle-loans"],
    ["retail-personal", "out-of-scope"],
    ["retail-education", "out-of-scope"],
    ["commercial-project-finance", "project-finance"],
    ["corporate-project-finance", "project-finance"],
    ["commercial-term-loan", "business-loans-unlisted-equity"],
    ["commercial-working-capital", "business-loans-unlisted-equity"],
    ["corporate-syndicated", "business-loans-unlisted-equity"],
    ["sme-working-capital", "business-loans-unlisted-equity"],
    ["sme-trade-finance", "business-loans-unlisted-equity"],
    ["sme-term-loan", "business-loans-unlisted-equity"],
    [undefined, "business-loans-unlisted-equity"],
  ];

  it.each(cases)("%s → %s", (category, expected) => {
    expect(assetClassForLoanCategory(category)).toBe(expected);
  });

  it("routes an unknown category to business loans via the default arm", () => {
    // Not reachable through the LoanCategory union, but the runtime `default`
    // arm exists as a guard — exercise it with a deliberate cast.
    expect(
      assetClassForLoanCategory("something-else" as unknown as LoanCategory),
    ).toBe("business-loans-unlisted-equity");
  });
});

// ===========================================================================
// inferPcafAvailability() — borrower catalog → availability flags
// ===========================================================================

describe("inferPcafAvailability · never infers the published-emissions flags", () => {
  it("leaves both publish flags false for a plain in-scope borrower", () => {
    const a = inferPcafAvailability(makeBorrower(), "commercial-term-loan");
    expect(a.borrower_publishes_verified).toBe(false);
    expect(a.borrower_publishes_unverified).toBe(false);
  });
});

describe("inferPcafAvailability · out-of-scope short-circuit", () => {
  it("retail-personal loan → out_of_scope, all data flags false", () => {
    const a = inferPcafAvailability(makeBorrower(), "retail-personal");
    expect(a.out_of_scope).toBe(true);
    expect(a.physical_activity_data_available).toBe(false);
    expect(a.revenue_data_available).toBe(false);
    expect(a.sector_average_only).toBe(true);
  });

  it("retail-education loan → out_of_scope", () => {
    const a = inferPcafAvailability(makeBorrower(), "retail-education");
    expect(a.out_of_scope).toBe(true);
  });

  it("retail-pool borrower → out_of_scope regardless of loan category", () => {
    const pool = makeBorrower({ kind: "retail-pool" });
    const a = inferPcafAvailability(pool, "commercial-term-loan");
    expect(a.out_of_scope).toBe(true);
  });
});

describe("inferPcafAvailability · physical-activity flag (Score-3 unlock)", () => {
  it("cement borrower WITH a facility → physical_activity true", () => {
    const b = makeBorrower({
      nrbSector: "Cement Manufacturing",
      facilities: [makeFacility()],
    });
    expect(
      inferPcafAvailability(b, "commercial-term-loan")
        .physical_activity_data_available,
    ).toBe(true);
  });

  it("cement borrower WITHOUT a facility → physical_activity false", () => {
    const b = makeBorrower({ nrbSector: "Cement Manufacturing", facilities: [] });
    expect(
      inferPcafAvailability(b, "commercial-term-loan")
        .physical_activity_data_available,
    ).toBe(false);
  });

  it("hydropower borrower WITH a facility → physical_activity true", () => {
    const b = makeBorrower({
      nrbSector: "Hydropower",
      facilities: [makeFacility()],
    });
    expect(
      inferPcafAvailability(b, "corporate-project-finance")
        .physical_activity_data_available,
    ).toBe(true);
  });

  it("facility-tier borrower (non-cement/hydro) WITH a facility → physical_activity true", () => {
    const b = makeBorrower({
      nrbSector: "Hospitality",
      dataTier: "facility",
      facilities: [makeFacility()],
    });
    expect(
      inferPcafAvailability(b, "commercial-term-loan")
        .physical_activity_data_available,
    ).toBe(true);
  });

  it("sector-benchmark borrower WITH a facility but non-facility tier → physical_activity false", () => {
    const b = makeBorrower({
      nrbSector: "Hospitality",
      dataTier: "sector-benchmark",
      facilities: [makeFacility()],
    });
    expect(
      inferPcafAvailability(b, "commercial-term-loan")
        .physical_activity_data_available,
    ).toBe(false);
  });
});

describe("inferPcafAvailability · revenue-proxy flag (Score-4 unlock)", () => {
  it("publicly-listed borrower → revenue_data_available true", () => {
    const b = makeBorrower({ publiclyListed: true });
    expect(
      inferPcafAvailability(b, "commercial-term-loan").revenue_data_available,
    ).toBe(true);
  });

  it("public-filing EV source → revenue_data_available true", () => {
    const b = makeBorrower({ publiclyListed: false, evSource: "public-filing" });
    expect(
      inferPcafAvailability(b, "commercial-term-loan").revenue_data_available,
    ).toBe(true);
  });

  it("private, estimated-EV borrower → revenue_data_available false", () => {
    const b = makeBorrower({ publiclyListed: false, evSource: "estimated" });
    expect(
      inferPcafAvailability(b, "commercial-term-loan").revenue_data_available,
    ).toBe(false);
  });
});

// ===========================================================================
// resolvePcafAvailability() — officer override composes over inferred
// ===========================================================================

describe("resolvePcafAvailability · officer overrides compose per-flag", () => {
  it("null saved row → returns the inferred bundle unchanged", () => {
    const inferred = inferPcafAvailability(makeBorrower(), "commercial-term-loan");
    expect(resolvePcafAvailability(inferred, null)).toBe(inferred);
  });

  it("undefined saved row → returns the inferred bundle unchanged", () => {
    const inferred = inferPcafAvailability(makeBorrower(), "commercial-term-loan");
    expect(resolvePcafAvailability(inferred, undefined)).toBe(inferred);
  });

  it("a partial saved row overrides only the flags it sets", () => {
    const inferred = noFlags();
    const resolved = resolvePcafAvailability(inferred, {
      borrower_publishes_verified: true,
    });
    expect(resolved.borrower_publishes_verified).toBe(true);
    // Every other flag falls through to the inferred value.
    expect(resolved.borrower_publishes_unverified).toBe(false);
    expect(resolved.physical_activity_data_available).toBe(false);
    expect(resolved.sector_average_only).toBe(true);
  });

  it("a full saved row overrides every flag", () => {
    const inferred = noFlags();
    const saved: PcafDataAvailability = {
      borrower_publishes_verified: true,
      borrower_publishes_unverified: true,
      energy_consumption_data_available: true,
      physical_activity_data_available: true,
      revenue_data_available: true,
      sector_average_only: false,
      out_of_scope: true,
    };
    expect(resolvePcafAvailability(inferred, saved)).toEqual(saved);
  });

  it("a false saved flag still wins over a true inferred flag (?? semantics)", () => {
    const inferred: PcafDataAvailability = {
      ...noFlags(),
      physical_activity_data_available: true,
    };
    const resolved = resolvePcafAvailability(inferred, {
      physical_activity_data_available: false,
    });
    expect(resolved.physical_activity_data_available).toBe(false);
  });
});

// ===========================================================================
// computePcafScore() — the §5 ladder, one row per option × asset class
// ===========================================================================

describe("computePcafScore · out-of-scope short-circuit", () => {
  it("availability.out_of_scope=true → Score 5, Option 3b, out-of-scope citation", () => {
    const r = computePcafScore(
      makeLoan({ category: "retail-personal" }),
      makeBorrower(),
      null,
      { ...noFlags(), out_of_scope: true },
      "out-of-scope",
    );
    expect(r.score).toBe(5);
    expect(r.option).toBe("3b");
    expect(r.assetClass).toBe("out-of-scope");
    expect(r.citation).toContain("asset class not in Part A scope");
    expect(r.method).toBe("Not in scope for PCAF Cat. 15");
    expect(r.dataSource).toBe("n/a");
  });

  it("assetClass=out-of-scope even with data flags → still short-circuits", () => {
    const r = computePcafScore(
      makeLoan(),
      makeBorrower(),
      null,
      { ...noFlags(), physical_activity_data_available: true },
      "out-of-scope",
    );
    expect(r.score).toBe(5);
    expect(r.assetClass).toBe("out-of-scope");
  });
});

describe("computePcafScore · business-loans ladder (§5.2)", () => {
  const ac: PcafAssetClass = "business-loans-unlisted-equity";
  const borrower = makeBorrower();
  const loan = makeLoan();

  it("verified published → Option 1a → Score 1", () => {
    const r = computePcafScore(
      loan,
      borrower,
      null,
      { ...noFlags(), borrower_publishes_verified: true },
      ac,
    );
    expect(r.score).toBe(1);
    expect(r.option).toBe("1a");
    expect(r.citation).toBe(
      `PCAF Part A 3rd Edition §5.2 · ${PCAF_OPTION_LABEL["1a"]}`,
    );
  });

  it("unverified published → Option 1b → Score 2", () => {
    const r = computePcafScore(
      loan,
      borrower,
      null,
      { ...noFlags(), borrower_publishes_unverified: true },
      ac,
    );
    expect(r.score).toBe(2);
    expect(r.option).toBe("1b");
    expect(r.citation).toContain("§5.2");
  });

  it("energy-consumption data → Option 2a → Score 3", () => {
    const r = computePcafScore(
      loan,
      borrower,
      null,
      { ...noFlags(), energy_consumption_data_available: true },
      ac,
    );
    expect(r.score).toBe(3);
    expect(r.option).toBe("2a");
  });

  it("physical-activity data → Option 2b → Score 3", () => {
    const r = computePcafScore(
      loan,
      borrower,
      null,
      { ...noFlags(), physical_activity_data_available: true },
      ac,
    );
    expect(r.score).toBe(3);
    expect(r.option).toBe("2b");
  });

  it("revenue data → Option 3a → Score 4", () => {
    const r = computePcafScore(
      loan,
      borrower,
      null,
      { ...noFlags(), revenue_data_available: true },
      ac,
    );
    expect(r.score).toBe(4);
    expect(r.option).toBe("3a");
  });

  it("sector-average only → Option 3b → Score 5", () => {
    const r = computePcafScore(loan, borrower, null, noFlags(), ac);
    expect(r.score).toBe(5);
    expect(r.option).toBe("3b");
  });

  it("higher flag wins the ladder even when lower flags are also set", () => {
    const r = computePcafScore(
      loan,
      borrower,
      null,
      {
        ...noFlags(),
        borrower_publishes_verified: true,
        physical_activity_data_available: true,
        revenue_data_available: true,
      },
      ac,
    );
    expect(r.option).toBe("1a");
    expect(r.score).toBe(1);
  });
});

describe("computePcafScore · project-finance method + citation (§5.3)", () => {
  const ac: PcafAssetClass = "project-finance";

  it("hydro project on Option 2b → IPCC reservoir method + §5.3 citation", () => {
    const hydro = makeBorrower({
      nrbSector: "Hydropower",
      facilities: [makeFacility()],
    });
    const r = computePcafScore(
      makeLoan({ category: "corporate-project-finance" }),
      hydro,
      null,
      { ...noFlags(), physical_activity_data_available: true },
      ac,
    );
    expect(r.score).toBe(3);
    expect(r.option).toBe("2b");
    expect(r.citation).toContain("§5.3");
    expect(r.method).toContain("installed capacity");
    expect(r.dataSource).toContain("hydropower");
  });
});

describe("computePcafScore · Option 2b method varies by sector", () => {
  it("cement borrower on 2b → cement production method", () => {
    const cement = makeBorrower({
      nrbSector: "Cement Manufacturing",
      facilities: [makeFacility()],
    });
    const r = computePcafScore(
      makeLoan(),
      cement,
      null,
      { ...noFlags(), physical_activity_data_available: true },
      "business-loans-unlisted-equity",
    );
    expect(r.method).toContain("tonne cement");
    expect(r.dataSource).toContain("Global Cement");
  });

  it("other sector on 2b → generic physical-production method", () => {
    const other = makeBorrower({ nrbSector: "Manufacturing" });
    const r = computePcafScore(
      makeLoan(),
      other,
      null,
      { ...noFlags(), physical_activity_data_available: true },
      "business-loans-unlisted-equity",
    );
    expect(r.method).toContain("primary physical production");
    expect(r.dataSource).toContain("Climate TRACE");
  });

  it("hydro borrower on 2b but NOT project-finance asset class → generic method", () => {
    // Exercises the `assetClass === project-finance && isHydro` guard being
    // false while isHydro is true: falls through to the generic 2b arm.
    const hydro = makeBorrower({
      nrbSector: "Hydropower",
      facilities: [makeFacility()],
    });
    const r = computePcafScore(
      makeLoan(),
      hydro,
      null,
      { ...noFlags(), physical_activity_data_available: true },
      "business-loans-unlisted-equity",
    );
    expect(r.method).toContain("primary physical production");
  });
});

describe("computePcafScore · Option 1/3a/3b method + data-source strings", () => {
  const ac: PcafAssetClass = "business-loans-unlisted-equity";
  const borrower = makeBorrower({ name: "Acme Cement Ltd." });
  const loan = makeLoan();

  it("1a data source names the borrower + assurance", () => {
    const r = computePcafScore(
      loan,
      borrower,
      null,
      { ...noFlags(), borrower_publishes_verified: true },
      ac,
    );
    expect(r.dataSource).toContain("Acme Cement Ltd.");
    expect(r.dataSource).toContain("assurance");
  });

  it("1b data source names the borrower annual report", () => {
    const r = computePcafScore(
      loan,
      borrower,
      null,
      { ...noFlags(), borrower_publishes_unverified: true },
      ac,
    );
    expect(r.dataSource).toContain("Acme Cement Ltd.");
    expect(r.method).toContain("unverified");
  });

  it("2a → utility/fuel data source", () => {
    const r = computePcafScore(
      loan,
      borrower,
      null,
      { ...noFlags(), energy_consumption_data_available: true },
      ac,
    );
    expect(r.dataSource).toContain("Utility");
  });

  it("3a → NEPSE + EDGAR revenue data source", () => {
    const r = computePcafScore(
      loan,
      borrower,
      null,
      { ...noFlags(), revenue_data_available: true },
      ac,
    );
    expect(r.dataSource).toContain("NEPSE");
    expect(r.method).toContain("revenue");
  });

  it("3b → EDGAR sector-average data source", () => {
    const r = computePcafScore(loan, borrower, null, noFlags(), ac);
    expect(r.dataSource).toContain("EDGAR");
    expect(r.method).toContain("Outstanding amount");
  });
});

describe("computePcafScore · mortgages & motor vehicles collapse to 3b (§5.5/§5.6)", () => {
  it("mortgages asset class → Option 3b → Score 5, §5.5 citation", () => {
    const r = computePcafScore(
      makeLoan({ category: "retail-mortgage" }),
      makeBorrower(),
      null,
      // Even with a strong flag, §5.5 collapses to 3b in the current rubric.
      { ...noFlags(), borrower_publishes_verified: true },
      "mortgages",
    );
    expect(r.score).toBe(5);
    expect(r.option).toBe("3b");
    expect(r.citation).toContain("§5.5");
  });

  it("motor-vehicle-loans asset class → Option 3b → Score 5, §5.6 citation", () => {
    const r = computePcafScore(
      makeLoan({ category: "retail-vehicle" }),
      makeBorrower(),
      null,
      { ...noFlags(), physical_activity_data_available: true },
      "motor-vehicle-loans",
    );
    expect(r.score).toBe(5);
    expect(r.option).toBe("3b");
    expect(r.citation).toContain("§5.6");
  });
});

// ===========================================================================
// Option → Score collapse table (§4) — pin the whole map, incl. 3c
// ===========================================================================

describe("SCORE_FOR_OPTION · pins the PCAF §4 option→score collapse", () => {
  it("maps every option letter to its documented score", () => {
    expect(SCORE_FOR_OPTION).toEqual({
      "1a": 1,
      "1b": 2,
      "2a": 3,
      "2b": 3,
      "3a": 4,
      "3b": 5,
      // 3c is a valid collapse target (Score 5) even though the demo's
      // chooseOption() ladder never selects it.
      "3c": 5,
    });
  });

  it("every option letter has a human-readable label", () => {
    for (const opt of Object.keys(SCORE_FOR_OPTION) as Array<
      keyof typeof SCORE_FOR_OPTION
    >) {
      expect(PCAF_OPTION_LABEL[opt]).toBeTruthy();
    }
  });
});
