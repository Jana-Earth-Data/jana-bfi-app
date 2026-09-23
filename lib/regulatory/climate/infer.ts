/**
 * Deterministic inference of BorrowerClimateRisk + BorrowerEmissionsFlag
 * from the demo's synthesized borrower catalogue.
 *
 * All logic here anchors to the 2022 NRB ESRM Guideline. Where a
 * concrete verbatim rule exists (25k tCO2e/yr threshold, NGFS taxonomy),
 * the code cites it inline. Where the demo has to bridge between the
 * borrower's sector / location and the NGFS categories, we use a
 * transparent sector table that a compliance reviewer can audit line
 * by line.
 *
 * Cited sections:
 *   - Physical + transition categories:            NRB ESRM 2022 §4.1
 *   - Nepal sector transmission channels:          NRB ESRM 2022 §4.2
 *   - 25,000 tCO2e / yr reporting threshold:       NRB ESRM 2022 §4.3
 *   - Reduction target expectation on above-threshold clients:
 *                                                  NRB ESRM 2022 §4.3
 *   - Portfolio-level tracking of climate risk:    NRB ESRM 2022 §4.4
 *
 * The functions here are pure and deterministic. Given the same borrower
 * they always produce the same climate metadata, so the demo does not
 * need to persist per-borrower rows to render a stable UI. When Supabase
 * is configured, `scripts/supabase-climate-risk.sql` provides an override
 * table so ESRM officers can hand-adjust the values.
 */

import type { Borrower } from "@/lib/types/bfi";
import {
  BorrowerClimateBundle,
  BorrowerClimateRisk,
  BorrowerEmissionsFlag,
  ClimateRiskRating,
  NgfsPhysicalRiskCategory,
  NgfsTransitionRiskCategory,
  NRB_ESRM_GHG_REPORTING_THRESHOLD_TCO2E,
} from "./types";

// ---------------------------------------------------------------------------
// Sector → NGFS category mapping (NRB ESRM 2022 §4.1, §4.2)
// ---------------------------------------------------------------------------
// Keys are lowercase substrings matched against `borrower.nrbSector`. The
// mapping is intentionally short so a compliance reviewer can eyeball
// each row against the source sector list without hunting through a
// giant switch statement.

type SectorClimateProfile = {
  match: RegExp;
  physical: NgfsPhysicalRiskCategory[];
  transition: NgfsTransitionRiskCategory[];
};

/**
 * Nepal-specific sector → climate risk exposure table.
 *
 * Physical risks follow the transmission channels named in NRB ESRM 2022
 * §4.2 (floods, water scarcity, temperature) plus the NGFS list in §4.1.
 * Transition risks reflect §4.1's four channels (policy, technology,
 * market/shifting sentiment, reputation) filtered by whether the sector
 * is fossil-intense, regulated, or exposed to shifting demand.
 */
const SECTOR_PROFILES: SectorClimateProfile[] = [
  // Hydropower — physical: flood + landslide; water scarcity affects
  // dry-season output; policy risk from PPA and licensing regime.
  {
    match: /hydropower|hydro/i,
    physical: ["Floods", "Water scarcity", "Temperature change"],
    transition: ["Policy risk"],
  },
  // Cement — high energy + water intensity, permit-heavy, exposed to
  // carbon-pricing / phase-out policy in Nepal's climate roadmap.
  {
    match: /cement/i,
    physical: ["Water scarcity", "Heat waves", "Droughts"],
    transition: ["Policy risk", "Market risk", "Reputation risk"],
  },
  // Steel / brick — same policy / market signals as cement.
  {
    match: /steel|brick/i,
    physical: ["Heat waves", "Water scarcity"],
    transition: ["Policy risk", "Market risk"],
  },
  // Chemicals / plastics — pollution-control regulation, market shift.
  {
    match: /chemical|plastic/i,
    physical: ["Heat waves", "Water scarcity"],
    transition: ["Policy risk", "Technology risk"],
  },
  // Textiles — water scarcity is the dominant physical channel, buyer
  // supply-chain audits drive reputation risk (H&M / Nike / Apple etc).
  {
    match: /textile|garment/i,
    physical: ["Water scarcity", "Floods"],
    transition: ["Reputation risk", "Market risk"],
  },
  // FMCG / food processing — supply-chain heat + flood risk, shifting
  // consumer sentiment on climate.
  {
    match: /fmcg|food|beverage/i,
    physical: ["Heat waves", "Floods", "Water scarcity"],
    transition: ["Market risk", "Reputation risk"],
  },
  // Agriculture — flood, drought, temperature change all hit yield.
  {
    match: /agriculture|farming/i,
    physical: [
      "Floods",
      "Droughts",
      "Water scarcity",
      "Temperature change",
    ],
    transition: ["Policy risk", "Market risk"],
  },
  // Transport & storage — physical from flood on road/rail corridors,
  // transition from clean-transport policy and EV disruption.
  {
    match: /transport|storage|logistics/i,
    physical: ["Floods", "Heat waves"],
    transition: ["Policy risk", "Technology risk"],
  },
  // Hospitality / tourism — heat + water scarcity + wildfire (mountain
  // regions) all show up in Nepal MoFE / ADB climate impact studies.
  {
    match: /hospitality|tourism|hotel/i,
    physical: ["Heat waves", "Water scarcity", "Wildfires"],
    transition: ["Market risk", "Reputation risk"],
  },
  // Real estate / construction — heat + flood exposure on urban stock.
  {
    match: /real estate|construction/i,
    physical: ["Floods", "Heat waves"],
    transition: ["Policy risk", "Market risk"],
  },
  // Waste utilities — flood on landfills / treatment plants, policy on
  // circular economy / EPR schemes.
  {
    match: /waste|utilities/i,
    physical: ["Floods", "Water scarcity"],
    transition: ["Policy risk"],
  },
  // Retail / wholesale — supply-chain flood, transition mild.
  {
    match: /wholesale|retail/i,
    physical: ["Floods"],
    transition: ["Market risk"],
  },
];

/** Fallback profile — every borrower gets at least one physical risk. */
const DEFAULT_PROFILE: SectorClimateProfile = {
  match: /.*/,
  physical: ["Floods", "Temperature change"],
  transition: ["Policy risk"],
};

function profileForBorrower(b: Borrower): SectorClimateProfile {
  const sector = b.nrbSector ?? "";
  for (const p of SECTOR_PROFILES) {
    if (p.match.test(sector)) return p;
  }
  return DEFAULT_PROFILE;
}

// ---------------------------------------------------------------------------
// Overall rating rollup (NRB ESRM 2022 §4.1)
// ---------------------------------------------------------------------------
// The 2022 Guideline does not publish a numeric aggregation formula for
// climate risk (analogous to the ESDD Low/Medium/High rating, §7.3.4 does
// not publish its formula either). We use a defensible count-based
// rollup that the compliance team can adjust in one place.
//
//   high   = >=4 physical categories, OR >=3 physical + any transition,
//            OR emissions above threshold
//   medium = >=2 physical categories or any transition risk
//   low    = one physical exposure or none
//
// This mirrors the "count + severity" trigger logic used elsewhere in
// the demo (see lib/regulatory/esdd/scoring.ts).

function rollupRating(
  physicalCount: number,
  transitionCount: number,
  aboveThreshold: boolean,
): ClimateRiskRating {
  if (aboveThreshold) return "high";
  if (physicalCount >= 4 || (physicalCount >= 3 && transitionCount >= 1)) {
    return "high";
  }
  if (physicalCount >= 2 || transitionCount >= 1) return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// Deterministic hash for the assessed-at timestamp
// ---------------------------------------------------------------------------

function stableHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0; // uint32
}

// ---------------------------------------------------------------------------
// Reduction-target seam (N0.3)
// ---------------------------------------------------------------------------
//
// Whether an above-threshold borrower has a documented GHG reduction target is
// DATA, not arithmetic — in a live deployment it is a fact the ESRM officer
// records (persisted in `bfi_climate_risk_assessments.reduction_target_on_file`;
// see the API override in app/api/climate/borrower/[id]/route.ts). It must NOT
// be fabricated inside lib/regulatory, or a live build inherits invented
// reduction targets on a disclosure surface (backlog N0.3, §0 principle).
//
// So the reduction-target value is INJECTED. `inferEmissionsFlag` accepts an
// optional seed keyed by borrower id; when absent — the live default — the flag
// is `false` / `null` and the officer override (empty by default) is the sole
// source. The demo passes `demoReductionTargetSeed` from lib/demo/climate-seed
// to reproduce the previous ~15% distribution, so demo output is unchanged.

/** A documented reduction target for one borrower, or its absence. */
export type ReductionTargetSeed = {
  onFile: boolean;
  details: string | null;
};

/** Injected per-borrower reduction-target provider (demo fixture or override). */
export type ReductionTargetSeedFn = (borrowerId: string) => ReductionTargetSeed;

const NO_REDUCTION_TARGET: ReductionTargetSeed = { onFile: false, details: null };

// ---------------------------------------------------------------------------
// Public inference API
// ---------------------------------------------------------------------------

/**
 * Estimate a borrower's annual GHG emissions in tCO2e.
 *
 * Preference order (per NRB ESRM 2022 §4.4 tracking expectations):
 *   1. Climate TRACE / GCCT facility total (satellite-anchored).
 *   2. Jana emission-factor × physical-activity data (borrower.totalCo2eTonnes).
 *   3. Null when nothing usable is available.
 */
export function estimateAnnualTco2e(b: Borrower): number | null {
  const facilitySum = b.facilities.reduce(
    (s, f) => s + (Number.isFinite(f.annualCo2eTonnes) ? f.annualCo2eTonnes : 0),
    0,
  );
  if (facilitySum > 0) return Math.round(facilitySum);
  if (Number.isFinite(b.totalCo2eTonnes) && b.totalCo2eTonnes > 0) {
    return Math.round(b.totalCo2eTonnes);
  }
  return null;
}

/**
 * Compute the 25,000 tCO2e / yr reporting threshold flag for a borrower.
 *
 * NRB ESRM 2022 §4.3: "Clients with more than 25,000 metric tons of
 * annual CO2 emissions need to report and should have an emission
 * reduction plan." Banks are expected to flag borrowers that cross the
 * threshold without a reduction target on file.
 *
 * Whether a reduction target is on file is INJECTED, not computed here — see
 * the "Reduction-target seam" note above. `seed` provides it per borrower;
 * when omitted (the live default) no target is asserted, and a below-threshold
 * borrower never carries one (§4.3 does not require it).
 */
export function inferEmissionsFlag(
  b: Borrower,
  seed?: ReductionTargetSeedFn,
): BorrowerEmissionsFlag {
  const estimated = estimateAnnualTco2e(b);
  const exceeds =
    estimated !== null &&
    estimated >= NRB_ESRM_GHG_REPORTING_THRESHOLD_TCO2E;

  // A reduction target is only meaningful for above-threshold borrowers, and
  // only when a provider (demo fixture or persisted officer override) supplies
  // one. Absent a seed, lib/regulatory asserts nothing.
  const target = exceeds && seed ? seed(b.id) : NO_REDUCTION_TARGET;

  return {
    estimatedAnnualTco2e: estimated ?? 0,
    exceedsReportingThreshold: exceeds,
    reductionTargetOnFile: target.onFile,
    targetDetails: target.details,
  };
}

/**
 * Compute the NGFS-aligned climate risk record for a borrower.
 *
 * Physical + transition categories come from the sector profile table
 * (NRB ESRM 2022 §4.1 + §4.2). The overall rating is a count + emissions
 * rollup — see `rollupRating`.
 */
export function inferClimateRisk(b: Borrower): BorrowerClimateRisk {
  const profile = profileForBorrower(b);
  const emissions = inferEmissionsFlag(b);
  const rating = rollupRating(
    profile.physical.length,
    profile.transition.length,
    emissions.exceedsReportingThreshold,
  );
  // Deterministic assessed-at timestamp — same borrower, same date. Uses
  // a fixed epoch so re-renders don't produce drifting timestamps.
  const assessedAt = new Date(
    Date.UTC(2025, 10, 1) + (stableHash(b.id) % (60 * 60 * 24 * 30)) * 1000,
  );
  return {
    physicalRisks: [...profile.physical],
    transitionRisks: [...profile.transition],
    overallRating: rating,
    assessedAt,
    assessedBy: "system: NRB ESRM 2022 §4.1 auto-inference",
  };
}

/**
 * Combined bundle — what the API endpoint and UI panel consume. `seed`
 * (optional) supplies the reduction-target fact; see `inferEmissionsFlag`.
 */
export function getBorrowerClimateBundle(
  b: Borrower,
  seed?: ReductionTargetSeedFn,
): BorrowerClimateBundle {
  return {
    borrowerId: b.id,
    climateRisk: inferClimateRisk(b),
    emissionsFlag: inferEmissionsFlag(b, seed),
  };
}

// ---------------------------------------------------------------------------
// Portfolio aggregations (NRB ESRM 2022 §4.4 reporting expectation)
// ---------------------------------------------------------------------------

export type ClimatePortfolioSummary = {
  borrowersAssessed: number;
  borrowersWithPhysicalRisk: number;
  borrowersWithTransitionRisk: number;
  aboveThresholdCount: number;
  aboveThresholdWithoutTargetCount: number;
  aboveThresholdWithTargetCount: number;
  aboveThresholdBorrowerIds: string[];
  aboveThresholdWithoutTargetBorrowerIds: string[];
};

/**
 * Aggregate the climate metadata across a borrower list. The output is
 * safe to embed in the SSR dashboard payload — every field is a scalar
 * or a bounded string[].
 *
 * The "above threshold without target" count is the compliance-relevant
 * flag NRB ESRM 2022 §4.3 asks banks to surface. `seed` (optional) supplies
 * the reduction-target facts; absent it, every above-threshold borrower is
 * counted as "without target" (the honest live default until officers record
 * targets) — see `inferEmissionsFlag`.
 */
export function summarisePortfolioClimate(
  borrowers: Borrower[],
  seed?: ReductionTargetSeedFn,
): ClimatePortfolioSummary {
  const scoped = borrowers.filter(
    (b) => b.kind !== "retail-pool" && b.nrbSector,
  );
  let borrowersWithPhysicalRisk = 0;
  let borrowersWithTransitionRisk = 0;
  const aboveThresholdBorrowerIds: string[] = [];
  const aboveThresholdWithoutTargetBorrowerIds: string[] = [];
  let aboveThresholdWithTargetCount = 0;

  for (const b of scoped) {
    const climate = inferClimateRisk(b);
    const flag = inferEmissionsFlag(b, seed);
    if (climate.physicalRisks.length > 0) borrowersWithPhysicalRisk += 1;
    if (climate.transitionRisks.length > 0) borrowersWithTransitionRisk += 1;
    if (flag.exceedsReportingThreshold) {
      aboveThresholdBorrowerIds.push(b.id);
      if (flag.reductionTargetOnFile) {
        aboveThresholdWithTargetCount += 1;
      } else {
        aboveThresholdWithoutTargetBorrowerIds.push(b.id);
      }
    }
  }

  return {
    borrowersAssessed: scoped.length,
    borrowersWithPhysicalRisk,
    borrowersWithTransitionRisk,
    aboveThresholdCount: aboveThresholdBorrowerIds.length,
    aboveThresholdWithoutTargetCount:
      aboveThresholdWithoutTargetBorrowerIds.length,
    aboveThresholdWithTargetCount,
    aboveThresholdBorrowerIds,
    aboveThresholdWithoutTargetBorrowerIds,
  };
}
