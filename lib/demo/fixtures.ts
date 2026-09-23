/**
 * Fabricated findings — hand-picked answers that no evidence supports.
 *
 * History
 * -------
 * This module used to hold two borrower-name substring lists
 * (PCAF_NAME_FIXTURES_VERIFIED / _UNVERIFIED) that inferPcafAvailability()
 * consumed to grant a handful of borrowers a PCAF Score 1 or 2. Those lists
 * were the one fabricated input still reaching the scoring path: a name match,
 * not a document, set the "borrower publishes verified emissions" flag.
 *
 * They have been replaced (backlog N0.4) by lib/demo/pcaf-evidence-seed.ts,
 * which fabricates the EVIDENCE instead of the flag: a verified assurance
 * opinion / GHG inventory record for the same borrowers, run through the same
 * resolveAvailability() a live officer's review flows through. The score is now
 * derived identically in demo and live; only the evidence's origin differs.
 *
 * The rule those lists established still holds: lib/regulatory/** contains no
 * fabricated content. Regulatory modules encode the standard and operate on
 * whatever they are handed. Anything invented is injected from lib/demo, and a
 * live build has nothing to inject.
 *
 * What remains here is synthAirQuality — a fabricated PM2.5 reading — for the
 * same reason: it is invented data the demo layer supplies, kept out of any
 * regulatory or client module.
 */

import { mulberry32, rangeFloat } from "@/lib/demo/synth-util";

// ---------------------------------------------------------------------------
// Synthetic air quality
// ---------------------------------------------------------------------------

/**
 * A plausible PM2.5 reading derived from a facility's coordinates.
 *
 * Moved out of lib/data/screening.ts, where it ran inline inside
 * buildScreening(). That function is called from a client component, so the
 * generator was being shipped to every browser -- the means to manufacture a
 * number that renders identically to a real OpenAQ station reading.
 *
 * Deterministic on the coordinates so the demo is stable between runs. The
 * latitude bands loosely track the real north-south gradient across Nepal:
 * the Terai is worse than the hills. That makes it plausible, not true.
 */
export function synthAirQuality(facility: {
  lat: number;
  lng: number;
  municipality?: string | null;
}): { pm25: number; readingDate: string; stationName: string } {
  const seedX = Math.floor(facility.lat * 1000);
  const seedY = Math.floor(facility.lng * 1000);
  const r = mulberry32(((seedX ^ seedY) | 1) >>> 0);
  const baseline = facility.lat < 27.5 ? 120 : facility.lat < 28 ? 80 : 50;
  return {
    pm25: Math.round(baseline + rangeFloat(-25, 60, r)),
    readingDate: "2025-11-01",
    stationName: facility.municipality
      ? `${facility.municipality} reference station`
      : "Nearest OpenAQ station",
  };
}
