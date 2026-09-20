/**
 * CHARACTERIZATION ("GOLDEN") TEST — live aggregator on the demo base.
 * jana-bfi-demo · Phase B of PROJECT_PLAN.md (pins the PR0 baseline).
 *
 * WHAT THIS PINS AND WHY
 * ----------------------
 * The dashboard has TWO aggregators that are supposed to compute the same
 * regulatory arithmetic over the same domain model:
 *
 *   • buildSummary()      — lib/demo/portfolio.ts, used by the demo provider.
 *   • recomputeSummary()  — lib/api/bfi.ts, used by the LIVE provider when a
 *                           real officer capture overlays the base book.
 *
 * Task N0.1 (§3a) collapses these two into one shared pure function, because
 * having two hand-maintained copies is exactly how a demo/live disclosure
 * divergence sneaks in. Before that collapse, we PIN the current relationship:
 * fed the identical (loans, borrowers, attributions) triple, the live
 * aggregator must reproduce the demo summary's headline figures EXACTLY. Any
 * pre-existing drift between the two copies would show up here as a failure —
 * and if N0.1's unification changes any of these numbers, that change is now
 * visible and reviewable instead of silent.
 *
 * This is the "two providers, one computation" invariant (backlog §0) asserted
 * as an executable test.
 */
import { getPortfolio } from "@/lib/demo/portfolio";
import { recomputeSummary } from "@/lib/api/bfi";
import type { BfiDemoData, PortfolioSummary } from "@/lib/types/bfi";

let data: BfiDemoData;
let live: PortfolioSummary;
beforeAll(async () => {
  data = await getPortfolio();
  // Same inputs the demo summary was built from — no officer overlay applied,
  // so the ONLY thing under test is aggregator equivalence.
  live = recomputeSummary(data.loans, data.borrowers, data.attributions);
});

describe("live aggregator · equivalence to demo on the same base", () => {
  it("reproduces the headline totals exactly", () => {
    const demo = data.portfolio;
    expect(live.totalLoans).toBe(demo.totalLoans);
    expect(live.totalOutstandingUsd).toBe(demo.totalOutstandingUsd);
    expect(live.totalOutstandingNpr).toBe(demo.totalOutstandingNpr);
    expect(live.totalAttributedCo2eTonnes).toBe(demo.totalAttributedCo2eTonnes);
    expect(live.weightedDataQuality).toBe(demo.weightedDataQuality);
  });

  it("reproduces the taxonomy breakdown (count and NPR-weighted)", () => {
    expect(live.taxonomyBreakdown).toEqual(data.portfolio.taxonomyBreakdown);
    expect(live.taxonomyBreakdownValue).toEqual(
      data.portfolio.taxonomyBreakdownValue,
    );
  });

  it("reproduces the sector breakdown row-for-row", () => {
    expect(live.sectorBreakdown).toEqual(data.portfolio.sectorBreakdown);
  });
});

describe("live aggregator · pinned absolute figures", () => {
  // Redundant with the equivalence assertions today, but pinned as ABSOLUTES so
  // that if N0.1 moves both aggregators together the diff is still caught here.
  it("pins the live headline figures", () => {
    expect(live.totalLoans).toBe(80_035);
    expect(live.totalAttributedCo2eTonnes).toBe(9_774_371);
    expect(live.weightedDataQuality).toBe(3.8);
    expect(live.taxonomyBreakdown).toEqual({
      green: 1_089,
      amber: 6_869,
      red: 1_444,
      unclassified: 70_633,
    });
  });
});
