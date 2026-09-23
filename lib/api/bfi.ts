/**
 * BFI Data Fetching Layer
 *
 *  - Mock mode (`NEXT_PUBLIC_DEMO_USE_MOCKS=true` or no token):
 *      returns the synthesized 80K-loan portfolio rooted in real Nepal entities.
 *  - Live mode (token present):
 *      overlays real Climate TRACE Nepal facility emissions onto the synthesized
 *      borrowers via name-pattern matching, then recomputes PCAF + summary.
 *
 * The loan and borrower data is always from the synthesizer (banks don't expose
 * loan books via API). What goes LIVE is the facility emissions.
 */

import { apiFetchAll } from "@/lib/api/client";
import { pcafAttributionFactor } from "@/lib/regulatory/pcaf/attribution";
import { summarise } from "@/lib/regulatory/pcaf/aggregation";
import { TREND_YEARS } from "@/lib/reporting/periods";
import { getDemoProvider } from "@/lib/demo/provider";
import { isDemoMode } from "@/lib/demo/mode";
import { emptyPortfolio } from "@/lib/data/empty-portfolio";
import {
  BfiDemoData,
  Borrower,
  PcafAttribution,
  PortfolioSummary,
  Loan,
} from "@/lib/types/bfi";

const FORCE_MOCKS = process.env.NEXT_PUBLIC_DEMO_USE_MOCKS === "true";

// ---------------------------------------------------------------------------
// Climate TRACE API types
// ---------------------------------------------------------------------------

type ClimateTraceEmission = {
  asset_id?: string;
  asset_name?: string;
  start_time?: string;
  co2e_tonnes?: number | string;
  sector_name?: string;
  lat?: number;
  lon?: number;
};

function toNumeric(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Facility matching: take a Climate TRACE asset_name and pick the synthesized
// borrower facility it should overlay onto.
// ---------------------------------------------------------------------------

type MatchIndex = {
  /** facilityName lower-cased -> {borrowerId, facilityIndex} */
  byFacilityName: Map<string, { borrowerId: string; facilityIndex: number }>;
  /** owner / borrower name lower-cased substring -> borrowerId */
  byBorrowerName: Map<string, string>;
};

function buildMatchIndex(borrowers: Borrower[]): MatchIndex {
  const byFacilityName = new Map<
    string,
    { borrowerId: string; facilityIndex: number }
  >();
  const byBorrowerName = new Map<string, string>();
  for (const b of borrowers) {
    // Keep substring keys around for fuzzy matches
    const owner = b.name.toLowerCase();
    byBorrowerName.set(owner, b.id);
    // First word as a coarser key (e.g. "Hongshi-Shivam Cement Pvt Ltd" -> "hongshi")
    const first = owner.split(/[\s-]+/)[0];
    if (first && first.length > 3) byBorrowerName.set(first, b.id);

    b.facilities.forEach((f, i) => {
      byFacilityName.set(f.facilityName.toLowerCase(), {
        borrowerId: b.id,
        facilityIndex: i,
      });
    });
  }
  return { byFacilityName, byBorrowerName };
}

function findMatch(
  assetName: string,
  index: MatchIndex
): { borrowerId: string; facilityIndex: number } | null {
  const name = assetName.toLowerCase();
  // Exact facility name match
  const exact = index.byFacilityName.get(name);
  if (exact) return exact;
  // Substring against facility names
  for (const [k, v] of index.byFacilityName) {
    if (name.includes(k) || k.includes(name)) return v;
  }
  // Owner-name substring → first facility of that borrower
  for (const [k, bid] of index.byBorrowerName) {
    if (name.includes(k)) return { borrowerId: bid, facilityIndex: 0 };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Live fetch + overlay
// ---------------------------------------------------------------------------

type LiveEmissionsForYear = {
  year: number;
  byFacilityKey: Map<
    string,
    { borrowerId: string; facilityIndex: number; co2e: number }
  >;
};

async function fetchYear(
  year: number,
  token: string
): Promise<ClimateTraceEmission[]> {
  const { results } = await apiFetchAll<ClimateTraceEmission>(
    "/api/v1/data-sources/climatetrace/emissions/",
    {
      params: {
        country_iso3: "NPL",
        page_size: 10000,
        start_date: `${year}-01-01`,
        end_date: `${year}-12-31`,
      },
      token,
    }
  );
  return results;
}

function overlayLive(
  base: BfiDemoData,
  yearsData: LiveEmissionsForYear[]
): BfiDemoData {
  // Mutate clones, not the cached portfolio
  const borrowers: Borrower[] = base.borrowers.map((b) => ({
    ...b,
    facilities: b.facilities.map((f) => ({
      ...f,
      emissionsByYear: f.emissionsByYear ? [...f.emissionsByYear] : undefined,
    })),
  }));

  // Pre-index facilities by (borrowerId, idx) for write-back
  for (const ye of yearsData) {
    for (const { borrowerId, facilityIndex, co2e } of ye.byFacilityKey.values()) {
      const b = borrowers.find((x) => x.id === borrowerId);
      if (!b) continue;
      const f = b.facilities[facilityIndex];
      if (!f) continue;
      // Update / insert in time series
      const series = f.emissionsByYear ?? [];
      const ix = series.findIndex((p) => p.year === ye.year);
      const rounded = Math.round(co2e);
      if (ix >= 0) series[ix] = { year: ye.year, co2eTonnes: rounded };
      else series.push({ year: ye.year, co2eTonnes: rounded });
      f.emissionsByYear = series;
      // Update most-recent annual figure if this is the latest year
      const maxYear = Math.max(...series.map((p) => p.year));
      if (ye.year === maxYear) {
        f.annualCo2eTonnes = rounded;
        f.emissionsYear = ye.year;
      }
    }
  }
  // Recompute borrower-total CO2e from facilities
  for (const b of borrowers) {
    if (b.facilities.length === 0) continue;
    b.totalCo2eTonnes = b.facilities.reduce(
      (s, f) => s + f.annualCo2eTonnes,
      0
    );
  }

  // Recompute attributions for ALL loans (PCAF depends on borrower totals)
  const byId = new Map(borrowers.map((b) => [b.id, b]));
  const attributions: PcafAttribution[] = base.loans.map((loan) => {
    const b = byId.get(loan.borrowerId)!;
    const prev = base.attributions.find((a) => a.loanId === loan.id)!;
    if (
      (loan.category ?? "").startsWith("retail-") ||
      b.kind === "retail-pool"
    ) {
      // out-of-scope stays out-of-scope
      return prev;
    }
    if (b.facilities.length === 0) {
      // sector-benchmark — already correct (no facility tier)
      return prev;
    }
    // Facility-tier re-overlay only reaches here, so the shared PCAF §4.2
    // attribution factor (lib/regulatory/pcaf/attribution.ts) applies the
    // facility EV floor — the same floor the demo aggregator uses. No local
    // floor literal lives in this file (N0.2).
    const af = pcafAttributionFactor(loan.outstandingUsd, b);
    return {
      ...prev,
      attributionFactor: af,
      attributedCo2eTonnes: Math.round(af * b.totalCo2eTonnes),
    };
  });

  // Rebuild summary with live attributions
  const portfolio = recomputeSummary(base.loans, borrowers, attributions);

  return {
    meta: {
      ...base.meta,
      isMock: false,
      generatedAt: new Date().toISOString(),
      pcafMethodologyNote:
        "Live: Climate TRACE facility emissions (Nepal) overlaid onto synthesized loan portfolio. " +
        "PCAF Cat. 15 attribution: outstanding USD / enterprise value USD x facility CO2e.",
    },
    borrowers,
    loans: base.loans,
    attributions,
    portfolio,
  };
}

// ONE COMPUTATION, TWO PROVIDERS (backlog N0.1). The portfolio roll-up that used
// to live here (recomputeSummary) and its demo twin (buildSummary in
// lib/demo/portfolio.ts) shared ~90 % of their logic and a hand-maintained "keep
// these in step" comment — the exact drift risk the regulatory boundary exists
// to remove. The two are now collapsed into the single shared computation
// `summarise()` in lib/regulatory/pcaf/aggregation.ts; both providers call it, so
// a disclosed total can no longer depend on which path produced it.
//
// This re-export keeps the historical name `recomputeSummary` so the existing
// live call sites are unchanged: the live overlay above (overlayLive) and
// lib/api/pcaf-overlay.ts both import { recomputeSummary } from "@/lib/api/bfi".
// It is a function declaration (not a const alias) so it stays hoisted for the
// overlayLive call above, which precedes this line.
export function recomputeSummary(
  loans: Loan[],
  borrowers: Borrower[],
  attributions: PcafAttribution[]
): PortfolioSummary {
  return summarise(loans, borrowers, attributions);
}

async function fetchLiveAndOverlay(
  base: BfiDemoData,
  token: string
): Promise<BfiDemoData> {
  // Pull annual aggregations 2021-2025. The Climate TRACE Nepal data is monthly
  // granularity; fetchYear()'s start/end filter selects all months in the year
  // and the loop in fetchLiveAndOverlay sums them per facility.
  const years = TREND_YEARS;
  const index = buildMatchIndex(base.borrowers);

  const yearsData: LiveEmissionsForYear[] = [];
  for (const y of years) {
    const rows = await fetchYear(y, token);
    const byFacilityKey = new Map<
      string,
      { borrowerId: string; facilityIndex: number; co2e: number }
    >();
    for (const row of rows) {
      const name = row.asset_name ?? "";
      if (!name) continue;
      const match = findMatch(name, index);
      if (!match) continue;
      const key = `${match.borrowerId}-${match.facilityIndex}`;
      const prev = byFacilityKey.get(key);
      byFacilityKey.set(key, {
        borrowerId: match.borrowerId,
        facilityIndex: match.facilityIndex,
        co2e: (prev?.co2e ?? 0) + toNumeric(row.co2e_tonnes),
      });
    }
    yearsData.push({ year: y, byFacilityKey });
  }

  return overlayLive(base, yearsData);
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

/**
 * Server-side: get BFI data.
 * - SSR (no token): synthesized portfolio (mock mode).
 * - With token: fetch live Climate TRACE data, overlay onto borrowers.
 */
/**
 * The base portfolio, from whichever source this build has -- and only if the
 * demo layer is switched on right now.
 *
 * A demo build gets the synthesized 80K-loan book. A live build has no
 * synthesizer compiled into it at all, so it gets a genuinely empty envelope:
 * no loans, no borrowers, no fabricated exposures. That is the correct state
 * for a bank whose core-banking import has not happened yet, and giving the
 * live path a real answer is what removes the temptation to keep the
 * synthesizer around "just for the empty case".
 *
 * The isDemoMode() check is the one that makes the header toggle mean
 * something. Without it the switch would repaint the chrome while the
 * dashboard carried on reporting 80,035 fabricated loans -- which is worse
 * than having no switch at all, because it would look like it worked.
 */
async function basePortfolio(): Promise<BfiDemoData> {
  if (!(await isDemoMode())) return emptyPortfolio();
  const provider = await getDemoProvider();
  return provider ? await provider.getPortfolio() : emptyPortfolio();
}

export async function getBfiDemoData(
  token?: string | null
): Promise<BfiDemoData> {
  const base = await basePortfolio();
  if (FORCE_MOCKS || !token) {
    return {
      ...base,
      meta: {
        ...base.meta,
        isMock: true,
        generatedAt: new Date().toISOString(),
      },
    };
  }
  try {
    return await fetchLiveAndOverlay(base, token);
  } catch (error) {
    console.error(
      "Live BFI data fetch failed, falling back to mock:",
      (error as Error).message
    );
    return {
      ...base,
      meta: {
        ...base.meta,
        isMock: true,
        generatedAt: new Date().toISOString(),
      },
    };
  }
}

/**
 * Helper for the management/status route - summarises Climate TRACE coverage.
 */
export async function fetchClimateTraceSummary(token: string) {
  const { count, results } = await apiFetchAll<ClimateTraceEmission>(
    "/api/v1/data-sources/climatetrace/emissions/",
    {
      params: {
        country_iso3: "NPL",
        page_size: 10000,
      },
      token,
    }
  );

  const sectors = new Set(results.map((r) => r.sector_name).filter(Boolean));
  const assets = new Set(results.map((r) => r.asset_name).filter(Boolean));

  const base = await basePortfolio();
  const index = buildMatchIndex(base.borrowers);
  let matched = 0;
  for (const r of results) {
    if (r.asset_name && findMatch(r.asset_name, index)) matched++;
  }

  return {
    totalRecords: Math.max(count, results.length),
    uniqueAssets: assets.size,
    uniqueSectors: sectors.size,
    matchedAssets: matched,
    portfolioBorrowers: base.borrowers.length,
  };
}

/**
 * Drop the synthesizer's in-process cache. Used by the seed routes after they
 * rewrite the loan book. A no-op in a live build, where there is no cache and
 * no synthesizer -- callers do not need to know which kind of build they are
 * in.
 */
export async function invalidatePortfolioCache(): Promise<void> {
  const provider = await getDemoProvider();
  provider?.invalidatePortfolioCache();
}
