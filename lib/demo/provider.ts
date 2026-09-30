/**
 * The single door to everything fabricated.
 *
 * Why a door rather than a filter
 * -------------------------------
 * The platform ships two kinds of data. Real: Climate TRACE facilities, EDGAR
 * grids, GCCT plant capacities, and whatever the bank captures. Fabricated:
 * an 80,035-loan portfolio invented by a seeded PRNG, borrower enterprise
 * values, and a handful of hardcoded name lists that hand specific borrowers
 * a PCAF score.
 *
 * The requirement is that no fabricated record can appear in a live
 * deployment. That could be met by filtering at every read, but a filter you
 * have to remember at every call site is a filter that will eventually be
 * forgotten -- and the failure is silent, because invented loans look exactly
 * like real ones. This codebase has already produced three bugs of that shape
 * in a single week: a swallowed query error, a missing scope filter, and a
 * stale flag, each of which rendered a confident wrong number rather than an
 * error.
 *
 * So the guarantee is structural instead. Everything fabricated lives under
 * lib/demo/, nothing outside may import it directly (enforced by
 * scripts/check-demo-imports.mjs and the other boundary guards), and this
 * module hands the demo layer out only when demo mode is on. Captures made in
 * demo mode are tagged with the `origin` provenance column, so they never
 * appear in the bank's own data.
 *
 * How the switch works
 * --------------------
 * This is one application. The demo code (./impl) is present in every
 * bundle -- there is no next.config.ts alias -- and isDemoBuild() reads
 * process.env.JANA_DEMO at RUNTIME. What JANA_DEMO decides is whether the demo
 * switch is available on this deployment (and whether the precomputed
 * portfolio file is generated). Where it is available, the per-user demo-mode
 * switch (./mode.ts) chooses per request between the demo portfolio and the
 * bank's own data. The guarantee that fabricated rows never reach production
 * data comes from this module being the only door to lib/demo plus the
 * provenance column on capture tables -- not from code being absent.
 * (Correction 2026-09-30: this block used to describe JANA_DEMO as a
 * build-time flag that compiles the demo code out of a "live build". It does
 * not. PROJECT_PLAN P5.8 makes this one build in name as well as in fact.)
 */

import type { BfiDemoData, Borrower } from "@/lib/types/bfi";
import type { PcafEvidenceRecord } from "@/lib/regulatory/pcaf/evidence-matrix";

/**
 * Everything the application is allowed to ask the demo layer for.
 *
 * Deliberately small. Each method added here is another thing the
 * demo-mode-off path has to have an answer for, so the pressure is toward keeping the real code
 * paths honest rather than reaching for fabricated data.
 */
export type DemoProvider = {
  /** The synthesized portfolio: loans, borrowers, attributions, summary. */
  getPortfolio(): Promise<BfiDemoData> | BfiDemoData;
  /** Drop the in-process cache. Used by the seed routes after a rewrite. */
  invalidatePortfolioCache(): void;
  /**
   * Seeded PCAF evidence records for a borrower — the fabricated document
   * review that puts the demo's exemplars at the top of the data-quality
   * ladder. A verified assurance opinion (→ Score 1) or GHG inventory
   * (→ Score 2) for the seeded borrowers, empty otherwise. Handed to
   * resolveAvailability() — the same resolver a live officer's review flows
   * through — rather than asserting a score directly, so the regulatory module
   * contains no fabricated content and demo/live derive scores identically.
   */
  pcafEvidenceRecords(borrower: Borrower): PcafEvidenceRecord[];
  /**
   * A plausible PM2.5 reading for a facility, when no real station reading is
   * available. Previously generated inline inside buildScreening(), which is
   * called from a client component -- so the generator shipped to every
   * browser. Now it is demo-only and server-side.
   */
  synthAirQuality(facility: {
    lat: number;
    lng: number;
    municipality?: string | null;
  }): { pm25: number; readingDate: string; stationName: string };
  /**
   * Demo-only reduction-target fixture. Whether an above-threshold borrower
   * has a documented GHG reduction target is a FACT a live bank records, not
   * arithmetic — so lib/regulatory/climate/infer.ts no longer fabricates it
   * (N0.3). This returns the demo seed (~15% share, canned commitments) that
   * is injected into inferEmissionsFlag / summarisePortfolioClimate so demo
   * output is unchanged. With demo mode off there is no seed, so those functions assert
   * no target until an officer records a real one.
   */
  reductionTargetSeed(
    borrowerId: string,
  ): { onFile: boolean; details: string | null };
};

/**
 * Whether the demo switch is available on this deployment at all.
 *
 * Despite the name, this is not a build property: it reads JANA_DEMO from the
 * environment at runtime (on each call). It is set per deployment, not per
 * request, so a request cannot change it. The demo code itself is in every
 * bundle regardless.
 */
export function isDemoBuild(): boolean {
  return process.env.JANA_DEMO === "1";
}

let cached: DemoProvider | null | undefined;

/**
 * Returns the demo provider, or null when the demo switch is not available on
 * this deployment (JANA_DEMO unset).
 *
 * Callers must handle null. That is the point: it forces every consumer to
 * have a real-data path rather than treating fabricated data as the default
 * and the bank's own data as the exception, which is how the current code got
 * here.
 *
 * The import is dynamic so the demo module is loaded only when used. It is
 * still present in every bundle -- no next.config.ts alias exists (see the
 * correction note at the top of this file).
 */
export async function getDemoProvider(): Promise<DemoProvider | null> {
  if (cached !== undefined) return cached;
  if (!isDemoBuild()) {
    cached = null;
    return null;
  }
  const mod = await import("./impl");
  cached = mod.demoProvider;
  return cached;
}

/**
 * The provider, but only when demo mode is switched ON for this request.
 *
 * getDemoProvider() answers "is the demo switch available on this
 * deployment?". This answers "is demo mode on for this request?", which is
 * what almost every caller actually means. Use this one unless you
 * specifically need the deployment-level answer.
 *
 * Server-only: isDemoMode() reads the cookie jar. The import is dynamic to
 * break the cycle (mode.ts imports isDemoBuild from this file) and to keep
 * next/headers out of this module's static graph, so provider.ts stays safe
 * to import from anywhere.
 */
export async function getActiveDemoProvider(): Promise<DemoProvider | null> {
  if (!isDemoBuild()) return null;
  const { isDemoMode } = await import("./mode");
  if (!(await isDemoMode())) return null;
  return getDemoProvider();
}

/**
 * Convenience for the request-time call site that re-scores officer-reviewed
 * borrowers (lib/api/pcaf-overlay.ts).
 *
 * Returns the seeded PCAF evidence records for a borrower when demo mode is
 * on, or `undefined` when it is off (or the switch is unavailable) — which is
 * exactly what the overlay wants when nothing should be seeded: a real
 * borrower's Score 1/2 rests only on the officer's own verified documents.
 * Resolving through the provider keeps the demo boundary intact (lib/api may
 * not import lib/demo directly) and keeps the overlay's derivation identical
 * to the precompute-time pcafFor(), so the score an officer saw when they saved matches the one baked
 * into the portfolio.
 *
 * Gating on mode as well as switch availability matters even though demo-off means an empty
 * portfolio today. The seed grants PCAF Score 1 and 2 to a handful of named
 * borrowers; once real borrowers are imported, a name collision with "Ghorahi"
 * or "Butwal Power" must not silently seed a real loan a verified-disclosure
 * score it has not earned. The gate costs nothing and closes that off before
 * the import lands.
 */
export async function demoPcafEvidenceRecords(): Promise<
  ((borrower: Borrower) => PcafEvidenceRecord[]) | undefined
> {
  const provider = await getActiveDemoProvider();
  return provider ? (b: Borrower) => provider.pcafEvidenceRecords(b) : undefined;
}

/**
 * Convenience for the call sites that compute the reduction-target flag.
 *
 * Returns a per-borrower seed function when demo mode is on, or `undefined`
 * when it is off (or the switch is unavailable) — which is exactly what
 * inferEmissionsFlag, getBorrowerClimateBundle and summarisePortfolioClimate
 * want when nothing should be asserted (N0.3). Resolve it once, then pass it
 * into the sync regulatory function; the same gate on switch availability AND
 * mode that protects the PCAF name fixtures protects this fixture too, so a
 * real loan-book import cannot conjure a
 * fabricated reduction target onto a real borrower.
 */
export async function demoReductionTargetSeed(): Promise<
  ((borrowerId: string) => { onFile: boolean; details: string | null }) | undefined
> {
  const provider = await getActiveDemoProvider();
  return provider ? (id: string) => provider.reductionTargetSeed(id) : undefined;
}

/**
 * Test seam. Resets the memoised provider so a test can flip JANA_DEMO
 * between cases.
 */
export function __resetDemoProviderCache(): void {
  cached = undefined;
}
