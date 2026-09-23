/**
 * Portfolio aggregation — the single computation that turns a loan book, its
 * borrowers, and per-loan PCAF attributions into the disclosed
 * {@link PortfolioSummary} (headline totals, weighted data quality, NRB
 * taxonomy breakdown, sector rollup, scoping funnel, PCAF data-quality
 * distribution, and the multi-year trend).
 *
 * ONE COMPUTATION, TWO PROVIDERS (backlog N0.1). This used to be two functions:
 * `buildSummary()` in `lib/demo/portfolio.ts` (demo synthesis path) and
 * `recomputeSummary()` in `lib/api/bfi.ts` (live re-overlay + officer-PCAF
 * overlay path). They shared ~90 % of their logic and a hand-maintained
 * "keep these in step" comment — exactly the drift risk the regulatory
 * boundary exists to remove: a disclosed total must not depend on which code
 * path produced it. The two are now collapsed into this one function; both
 * providers call it. `lib/api/bfi.ts` re-exports it under the historical name
 * `recomputeSummary` so existing live call sites (the live overlay and
 * `lib/api/pcaf-overlay.ts`) are unchanged.
 *
 * The kept implementation is the optimized one (Map-based id lookups, no
 * O(n²) `Array.find()` inner scans) — at 80K loans the superseded demo copy's
 * inner scans were ~6.4B comparisons and dominated every force-dynamic render.
 *
 * NB: this function does NOT compute attribution factors — it consumes the
 * per-loan {@link PcafAttribution}s the caller already built (via
 * `pcafAttributionFactor` in ./attribution.ts). It only aggregates. That keeps
 * the attribution policy (the EV floor, §4.2) in one place and the roll-up
 * arithmetic in another.
 */

import {
  Borrower,
  DataQualityDistribution,
  Loan,
  PcafAttribution,
  PortfolioFunnel,
  PortfolioSummary,
  PortfolioTrendPoint,
  TaxonomyBreakdown,
} from "@/lib/types/bfi";
import { TREND_YEARS } from "@/lib/regulatory/reporting/period";

function emptyTaxonomy(): TaxonomyBreakdown {
  return { green: 0, amber: 0, red: 0, unclassified: 0 };
}

/**
 * Aggregate a loan book + borrowers + attributions into the disclosed
 * PortfolioSummary. Pure function of its inputs; the demo synthesizer and the
 * live/overlay paths both call it so the two can never diverge.
 */
export function summarise(
  loans: Loan[],
  borrowers: Borrower[],
  attributions: PcafAttribution[],
): PortfolioSummary {
  const borrowerMap = new Map(borrowers.map((b) => [b.id, b]));
  const attrByLoan = new Map(attributions.map((a) => [a.loanId, a]));
  // Loan lookup by id, built once so the data-quality-bucket loop below is a
  // Map get() per attribution instead of a full loans.find() scan — at 80K
  // loans that inner scan was O(n^2) (~6.4B comparisons) and dominated the
  // officer-PCAF overlay's recompute, adding ~10s of blocking CPU to every
  // force-dynamic homepage render.
  const loanById = new Map(loans.map((l) => [l.id, l]));

  const totalLoans = loans.length;
  const totalOutstandingNpr = loans.reduce((s, l) => s + l.outstandingNpr, 0);
  const totalOutstandingUsd = loans.reduce((s, l) => s + l.outstandingUsd, 0);
  const totalAttributedCo2eTonnes = attributions.reduce(
    (s, a) => s + a.attributedCo2eTonnes,
    0,
  );

  // Weighted average data quality across loans that produced attributed
  // emissions (PCAF Part A §4 — emissions-weighted portfolio score).
  let weightedSum = 0;
  let weightedDenom = 0;
  for (const a of attributions) {
    if (a.attributedCo2eTonnes <= 0) continue;
    weightedSum += a.dataQualityScore * a.attributedCo2eTonnes;
    weightedDenom += a.attributedCo2eTonnes;
  }
  const weightedDataQuality =
    weightedDenom > 0
      ? Math.round((weightedSum / weightedDenom) * 10) / 10
      : 0;

  const taxonomyBreakdown = emptyTaxonomy();
  const taxonomyBreakdownValue = emptyTaxonomy();
  for (const l of loans) {
    taxonomyBreakdown[l.nrbTaxonomy]++;
    taxonomyBreakdownValue[l.nrbTaxonomy] += l.outstandingNpr;
  }

  // Sector breakdown — only over loans whose borrower has a real sector
  // (retail-pool skipped).
  const sectorMap = new Map<
    string,
    { co2e: number; count: number; npr: number }
  >();
  for (const loan of loans) {
    const b = borrowerMap.get(loan.borrowerId);
    if (!b || b.kind === "retail-pool") continue;
    const a = attrByLoan.get(loan.id);
    const prev = sectorMap.get(b.nrbSector) ?? { co2e: 0, count: 0, npr: 0 };
    sectorMap.set(b.nrbSector, {
      co2e: prev.co2e + (a?.attributedCo2eTonnes ?? 0),
      count: prev.count + 1,
      npr: prev.npr + loan.outstandingNpr,
    });
  }
  const sectorBreakdown = Array.from(sectorMap.entries())
    .map(([sector, v]) => ({
      sector,
      attributedCo2e: Math.round(v.co2e),
      loanCount: v.count,
      outstandingNpr: v.npr,
    }))
    .sort((a, b) => b.attributedCo2e - a.attributedCo2e);

  // Scoping funnel — total → in-scope (non-retail) → facility-matched.
  const inScopeLoans = loans.filter(
    (l) => !(l.category ?? "").startsWith("retail-"),
  );
  const facilityMatchedLoans = inScopeLoans.filter((l) => {
    const b = borrowerMap.get(l.borrowerId);
    return b && b.dataTier === "facility";
  });
  const inScopeOutstandingNpr = inScopeLoans.reduce(
    (s, l) => s + l.outstandingNpr,
    0,
  );
  const facilityMatchedOutstandingNpr = facilityMatchedLoans.reduce(
    (s, l) => s + l.outstandingNpr,
    0,
  );
  const funnel: PortfolioFunnel = {
    totalLoans,
    inScopeLoans: inScopeLoans.length,
    facilityMatchedLoans: facilityMatchedLoans.length,
    facilityMatchedBorrowers: new Set(
      facilityMatchedLoans.map((l) => l.borrowerId),
    ).size,
    totalOutstandingNpr,
    inScopeOutstandingNpr,
    facilityMatchedOutstandingNpr,
  };

  // Data-quality distribution by PCAF score (1–5).
  const dqBuckets = new Map<
    1 | 2 | 3 | 4 | 5,
    { count: number; outstandingUsd: number; outstandingNpr: number; co2: number }
  >();
  for (const a of attributions) {
    const prev =
      dqBuckets.get(a.dataQualityScore) ?? {
        count: 0,
        outstandingUsd: 0,
        outstandingNpr: 0,
        co2: 0,
      };
    const loan = loanById.get(a.loanId);
    dqBuckets.set(a.dataQualityScore, {
      count: prev.count + 1,
      outstandingUsd: prev.outstandingUsd + (loan?.outstandingUsd ?? 0),
      outstandingNpr: prev.outstandingNpr + (loan?.outstandingNpr ?? 0),
      co2: prev.co2 + a.attributedCo2eTonnes,
    });
  }
  const dataQualityDistribution: DataQualityDistribution = [1, 2, 3, 4, 5].map(
    (s) => {
      const v =
        dqBuckets.get(s as 1 | 2 | 3 | 4 | 5) ?? {
          count: 0,
          outstandingUsd: 0,
          outstandingNpr: 0,
          co2: 0,
        };
      return {
        score: s as 1 | 2 | 3 | 4 | 5,
        loanCount: v.count,
        outstandingUsd: Math.round(v.outstandingUsd),
        outstandingNpr: Math.round(v.outstandingNpr),
        attributedCo2eTonnes: Math.round(v.co2),
      };
    },
  );

  // Multi-year trend — aggregate each borrower's per-year facility emissions,
  // weighted by the loan's attribution factor. Shares TREND_YEARS with the
  // reporting-period module rather than restating the range. Three cases:
  //   • retail-pool     → flat revenue-proxy attribution (year-over-year
  //                       constant), included so the Unclassified band matches
  //                       the data-quality distribution's Score-5 total;
  //   • facility tier   → attributionFactor × Σ facilities' per-year emissions
  //                       (falling back to a facility's flat annual figure for
  //                       any year missing from its series);
  //   • sector-benchmark→ flat attributed figure (no per-year series exists).
  const trend: PortfolioTrendPoint[] = TREND_YEARS.map((y) => {
    let total = 0;
    const tx = emptyTaxonomy();
    for (const loan of loans) {
      const b = borrowerMap.get(loan.borrowerId);
      if (!b) continue;
      const a = attrByLoan.get(loan.id);
      if (!a) continue;
      let yearTotal = 0;
      if (b.kind === "retail-pool") {
        yearTotal = a.attributedCo2eTonnes;
      } else if (b.facilities.length > 0) {
        let perFacility = 0;
        for (const f of b.facilities) {
          const pt = f.emissionsByYear?.find((p) => p.year === y);
          perFacility += pt?.co2eTonnes ?? f.annualCo2eTonnes;
        }
        yearTotal = a.attributionFactor * perFacility;
      } else {
        yearTotal = a.attributedCo2eTonnes;
      }
      total += yearTotal;
      tx[loan.nrbTaxonomy] += yearTotal;
    }
    return {
      year: y,
      totalAttributedCo2eTonnes: Math.round(total),
      byTaxonomy: {
        green: Math.round(tx.green),
        amber: Math.round(tx.amber),
        red: Math.round(tx.red),
        unclassified: Math.round(tx.unclassified),
      },
    };
  });

  return {
    totalLoans,
    totalOutstandingUsd: Math.round(totalOutstandingUsd),
    totalOutstandingNpr,
    totalAttributedCo2eTonnes: Math.round(totalAttributedCo2eTonnes),
    weightedDataQuality,
    taxonomyBreakdown,
    taxonomyBreakdownValue,
    sectorBreakdown,
    funnel,
    dataQualityDistribution,
    trend,
  };
}
