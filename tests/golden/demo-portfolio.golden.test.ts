/**
 * CHARACTERIZATION ("GOLDEN") TEST — demo portfolio disclosed totals.
 * jana-bfi-demo · Phase B of PROJECT_PLAN.md (pins the PR0 baseline).
 *
 * WHAT THIS PINS AND WHY
 * ----------------------
 * PR0 (Regulatory integrity, §3a / Tier N0) is about to change HOW several
 * disclosed numbers are produced — the EV floor (N0.2), the retail emissions
 * factor (N0.5), the demo/live aggregator collapse (N0.1), the evidence-driven
 * PCAF scoring (N0.4), etc. Those are refactors of the PLUMBING, not
 * (intentionally) of the RESULT. This suite freezes the exact figures the
 * dashboard discloses TODAY so that when PR0 lands, every number that moves is
 * a deliberate, reviewed change — not an accident. A red diff here during PR0
 * is the signal to stop and decide: "did we mean to move this?".
 *
 * These literals were captured from a deterministic run of the pure synthesizer
 * (seed 0xb1f0b1f0, mulberry32, no Math.random) on 2026-09-19 and verified
 * identical across two independent runs. If the synthesizer is deterministic —
 * and it is, by construction — these never drift on their own.
 *
 * SCOPE NOTE: this suite characterizes the DEMO provider (getPortfolio()).
 * The live-overlay divergence is pinned separately in live-overlay.golden.
 */
import { getPortfolio } from "@/lib/demo/portfolio";
import type { BfiDemoData } from "@/lib/types/bfi";

// One synthesis for the whole file — buildPortfolio() is ~15s. getPortfolio()
// memoizes module-scope, so later suites in the same worker reuse this.
let data: BfiDemoData;
beforeAll(async () => {
  data = await getPortfolio();
});

describe("demo portfolio · population counts", () => {
  it("synthesizes the pinned borrower / loan / attribution counts", () => {
    expect(data.borrowers.length).toBe(302);
    expect(data.loans.length).toBe(80_035);
    expect(data.attributions.length).toBe(80_035);
    // One attribution per loan — no orphans, no doubles.
    expect(data.attributions.length).toBe(data.loans.length);
  });

  it("stamps the pinned demo metadata", () => {
    expect(data.meta.bankName).toBe("First Bank of Nepal");
    // N0.7 (reviewed change): meta.asOfDate is now the reporting-period as-of
    // date (last day of ingested coverage, LATEST_YEAR through October) sourced
    // from lib/regulatory/reporting/period.ts, not the demo's loan-lifecycle
    // anchor (SYNTH_ANCHOR_DATE, still 2026-05-01). This reconciles the
    // disclosed as-of with the /api/pcaf/scores docstring example (2025-10-31).
    // No KPI moves: loan dates still derive from SYNTH_ANCHOR_DATE, so counts,
    // tonnes, and DQ below are unchanged.
    expect(data.meta.asOfDate).toBe("2025-10-31");
    expect(data.meta.isMock).toBe(true);
  });
});

describe("demo portfolio · headline disclosed totals", () => {
  it("pins the top-line KPIs", () => {
    const p = data.portfolio;
    expect(p.totalLoans).toBe(80_035);
    expect(p.totalOutstandingUsd).toBe(7_429_516_198);
    expect(p.totalOutstandingNpr).toBe(991_840_412_488);
    // The headline financed-emissions figure. The retail factor (N0.5) is
    // tuned so this stays under 10,000,000 tCO2e — PR0 will re-derive it.
    expect(p.totalAttributedCo2eTonnes).toBe(9_774_371);
    expect(p.totalAttributedCo2eTonnes).toBeLessThan(10_000_000);
    expect(p.weightedDataQuality).toBe(3.8);
  });

  it("pins the NRB taxonomy breakdown (by loan count)", () => {
    expect(data.portfolio.taxonomyBreakdown).toEqual({
      green: 1_089,
      amber: 6_869,
      red: 1_444,
      unclassified: 70_633,
    });
    // Counts partition the whole book.
    const t = data.portfolio.taxonomyBreakdown;
    expect(t.green + t.amber + t.red + t.unclassified).toBe(80_035);
  });

  it("pins the NRB taxonomy breakdown (weighted by outstanding NPR)", () => {
    expect(data.portfolio.taxonomyBreakdownValue).toEqual({
      green: 133_329_767_047,
      amber: 324_571_145_290,
      red: 186_620_407_749,
      unclassified: 347_319_092_402,
    });
    // NPR-weighted buckets sum to total outstanding NPR.
    const v = data.portfolio.taxonomyBreakdownValue!;
    expect(v.green + v.amber + v.red + v.unclassified).toBe(
      data.portfolio.totalOutstandingNpr,
    );
  });

  it("pins the scoping funnel (total → in-scope → facility-matched)", () => {
    expect(data.portfolio.funnel).toEqual({
      totalLoans: 80_035,
      inScopeLoans: 10_035,
      facilityMatchedLoans: 843,
      facilityMatchedBorrowers: 114,
      totalOutstandingNpr: 991_840_412_488,
      inScopeOutstandingNpr: 651_125_076_775,
      facilityMatchedOutstandingNpr: 412_399_420_542,
    });
  });
});

describe("demo portfolio · data-quality distribution (PCAF 1–5)", () => {
  it("pins the loan-count and attributed-tonnes per score bucket", () => {
    const dist = (data.portfolio.dataQualityDistribution ?? []).map((b) => ({
      score: b.score,
      loanCount: b.loanCount,
      attributedCo2eTonnes: Math.round(b.attributedCo2eTonnes),
    }));
    expect(dist).toEqual([
      { score: 1, loanCount: 5, attributedCo2eTonnes: 34_675 },
      { score: 2, loanCount: 39, attributedCo2eTonnes: 127_347 },
      { score: 3, loanCount: 991, attributedCo2eTonnes: 5_544_038 },
      { score: 4, loanCount: 0, attributedCo2eTonnes: 0 },
      { score: 5, loanCount: 79_000, attributedCo2eTonnes: 4_068_311 },
    ]);
  });

  it("distribution loan counts sum to the whole book", () => {
    const total = (data.portfolio.dataQualityDistribution ?? []).reduce(
      (n, b) => n + b.loanCount,
      0,
    );
    expect(total).toBe(80_035);
  });
});

describe("demo portfolio · sector breakdown", () => {
  it("pins the emissions-ranked sector table", () => {
    const sectors = data.portfolio.sectorBreakdown.map((s) => ({
      sector: s.sector,
      attributedCo2e: s.attributedCo2e,
      loanCount: s.loanCount,
    }));
    expect(sectors).toEqual([
      { sector: "Manufacturing - Cement", attributedCo2e: 4_262_255, loanCount: 282 },
      { sector: "Manufacturing - Brick", attributedCo2e: 1_253_260, loanCount: 1_108 },
      { sector: "Transport & Storage", attributedCo2e: 599_665, loanCount: 1_206 },
      { sector: "Hospitality - Tourism", attributedCo2e: 521_631, loanCount: 953 },
      { sector: "Manufacturing - Textiles", attributedCo2e: 228_366, loanCount: 720 },
      { sector: "Manufacturing - Plastics", attributedCo2e: 178_895, loanCount: 1_003 },
      { sector: "Real Estate - Commercial", attributedCo2e: 166_476, loanCount: 35 },
      { sector: "Agriculture - Processing", attributedCo2e: 161_859, loanCount: 1_820 },
      { sector: "Manufacturing - Steel", attributedCo2e: 132_813, loanCount: 54 },
      { sector: "Construction", attributedCo2e: 89_223, loanCount: 959 },
      { sector: "Utilities - Waste Management", attributedCo2e: 49_733, loanCount: 64 },
      { sector: "Manufacturing - FMCG", attributedCo2e: 36_608, loanCount: 81 },
      { sector: "Wholesale & Retail Trade", attributedCo2e: 33_688, loanCount: 633 },
      { sector: "Energy - Hydropower", attributedCo2e: 7_911, loanCount: 1_089 },
      { sector: "Manufacturing - Chemicals", attributedCo2e: 7_569, loanCount: 28 },
    ]);
  });

  it("sector breakdown is sorted descending by attributed emissions", () => {
    const co2 = data.portfolio.sectorBreakdown.map((s) => s.attributedCo2e);
    const sorted = [...co2].sort((a, b) => b - a);
    expect(co2).toEqual(sorted);
  });
});

describe("demo portfolio · multi-year trend", () => {
  it("pins the 2021–2025 emissions trend with taxonomy split", () => {
    const trend = (data.portfolio.trend ?? []).map((t) => ({
      year: t.year,
      total: t.totalAttributedCo2eTonnes,
      green: t.byTaxonomy.green,
      amber: t.byTaxonomy.amber,
      red: t.byTaxonomy.red,
      unclassified: t.byTaxonomy.unclassified,
    }));
    expect(trend).toEqual([
      { year: 2021, total: 9_684_032, green: 7_831, amber: 1_978_042, red: 5_620_053, unclassified: 2_078_107 },
      { year: 2022, total: 9_772_980, green: 7_891, amber: 1_996_110, red: 5_690_873, unclassified: 2_078_107 },
      { year: 2023, total: 9_850_621, green: 7_936, amber: 2_028_322, red: 5_736_256, unclassified: 2_078_107 },
      { year: 2024, total: 9_893_061, green: 8_309, amber: 2_045_536, red: 5_761_109, unclassified: 2_078_107 },
      { year: 2025, total: 8_964_337, green: 6_917, amber: 1_837_625, red: 5_041_688, unclassified: 2_078_107 },
    ]);
  });

  it("covers exactly the five reportable trend years", () => {
    const years = (data.portfolio.trend ?? []).map((t) => t.year);
    expect(years).toEqual([2021, 2022, 2023, 2024, 2025]);
  });
});
