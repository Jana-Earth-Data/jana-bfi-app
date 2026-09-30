/**
 * Per-loan PCAF data-quality score computation.
 *
 * All logic in this file is derived from
 * *PCAF Global GHG Accounting and Reporting Standard, Part A: Financed
 * Emissions*, Third Edition (Dec 2025 / release 15 Jan 2026), cross-checked
 * against the 2nd-edition Annex (reproduced verbatim in the CDFI working
 * guide, R4 §3.2-3.5).
 *
 * The public entry point is {@link computePcafScore}. It takes a loan, its
 * borrower, an optional per-loan facility snapshot, an availability flag
 * bundle, and the asset class routing, and returns a
 * {@link PcafComputationResult} with the score, option letter, method
 * summary, data source, and citation.
 *
 * Design principles (from R4 §7 and §10):
 * 1. **Right ceiling only if the data supports it.** Score 2 requires the
 *    borrower to publish GHG-Protocol-conformant emissions; almost no
 *    Nepal SPV does. Score 3 is the honest ceiling with Climate TRACE +
 *    facility physical output.
 * 2. **Fail down, not up.** If a flag is unset, the loan falls to the next
 *    lower-quality option per the §5 rubric — Score 5 is the default when
 *    the only data available is a sector average per unit of asset.
 * 3. **Cite the paragraph.** Every result carries a citation like
 *    "PCAF Part A 3rd Edition §5.2 · Option 2b" so an auditor can trace
 *    the number back to a specific standard section.
 *
 * **Hydropower lifecycle emission factor (N2.4 resolution):**
 * The 15 tCO₂e/MW/yr factor applied to Nepal hydropower capacity is a
 * LIFECYCLE CO₂e factor (construction + operation + decommissioning), not a
 * reservoir CH₄ emission factor. This determination is based on:
 *
 * 1. **Consistency with literature:** 15 tCO₂e/MW/yr converts to ~3-4 gCO₂e/kWh
 *    (at typical 50% capacity factor), matching run-of-river hydropower
 *    lifecycle emissions in peer-reviewed LCA studies (median ~4 gCO₂e/kWh,
 *    Peruvian Andes run-of-river <3 gCO₂e/kWh).
 *
 * 2. **Nepal hydro context:** Nepal's hydropower sector is predominantly
 *    run-of-river with minimal reservoir storage, so lifecycle emissions are
 *    dominated by construction/materials rather than reservoir methane.
 *
 * 3. **IPCC 2019 Refinement guidance:** Vol.4 Ch.7 provides CH₄ emission
 *    factors in kg CH₄/ha/yr (area-based), NOT tCO₂e/MW/yr (capacity-based).
 *    Converting area-based CH₄ to capacity-based CO₂e requires reservoir area,
 *    CH₄→CO₂e conversion (GWP₁₀₀ ×28-30), plus CO₂ and lifecycle components.
 *
 * 4. **Field name:** The factor flows into `annualCo2eTonnes`, and entities.ts
 *    explicitly documents it as "lifecycle attribution" (entities.ts:250).
 *
 * If this were CH₄-basis requiring GWP conversion per IFRS S2 B22, the CO₂e
 * figure would be 28-30× higher (~450 tCO₂e/MW/yr), which is inconsistent with
 * all hydropower LCA literature. Therefore: NO GWP conversion is applied; the
 * 15 tCO₂e/MW/yr is used as-is per the B22 first-sentence exemption (factors
 * already expressed in CO₂e are not recalculated).
 */

import type { Borrower, Loan, LoanCategory } from "@/lib/types/bfi";
import {
  PCAF_ASSET_CLASS_SECTION,
  PCAF_OPTION_LABEL,
  PcafAssetClass,
  PcafComputationResult,
  PcafDataAvailability,
  PcafOption,
  PcafScore,
  SCORE_FOR_OPTION,
  isSupportedForLoanOrigination,
  isInvestmentPortfolioClass,
} from "./types";

// ---------------------------------------------------------------------------
// Published-emissions flags are not inferred here
// ---------------------------------------------------------------------------
//
// PCAF Score 1 (Option 1a) requires the borrower to publish
// GHG-Protocol-conformant emissions AND have them third-party verified;
// Score 2 (Option 1b) drops the verification requirement. Neither can be
// inferred from anything this module can see -- establishing them means
// someone opening the annual report and looking, which is what
// lib/regulatory/pcaf/evidence-matrix.ts records.
//
// So inferPcafAvailability() below leaves both publish flags FALSE. They are
// set only by a verified evidence document, via resolveAvailability() in
// evidence-matrix.ts. The demo seeds that evidence (lib/demo/pcaf-evidence-
// seed.ts); a live build has none until an officer reviews a real report. This
// module no longer takes name fixtures at all -- there is nothing fabricated
// left in the scoring path (backlog N0.4).

// ---------------------------------------------------------------------------
// Asset-class routing — Loan category → PCAF Part A §5.x asset class
// ---------------------------------------------------------------------------

/**
 * Route a bank loan-category to a PCAF §5 asset class for **loan origination** portfolios.
 *
 * This router covers the five PCAF asset classes that apply to a commercial bank's
 * **lending book** (loans originated by the bank). Returns one of:
 * - `business-loans-unlisted-equity` (§5.2) — SME, commercial, corporate loans
 * - `project-finance` (§5.3) — Infrastructure, hydropower, self-contained projects
 * - `mortgages` (§5.5) — Residential real estate loans
 * - `motor-vehicle-loans` (§5.6) — Consumer/business vehicle financing
 * - `out-of-scope` — Retail personal/education (not in PCAF Cat. 15)
 *
 * **Investment portfolio classes are not returned** — the five classes for equity/bond
 * holdings (`listed-equity-corporate-bonds`, `sovereign-debt`, `sub-sovereign-debt`,
 * `securitisation-structured-products`, `use-of-proceeds-structures`) and
 * `commercial-real-estate` (no matching loan category) require separate financed
 * emissions calculation per PCAF Part A §5.1, §5.4, §5.7–§5.10. These are declared
 * in the `PcafAssetClass` type for completeness but are **explicitly unsupported**
 * for loan origination — see `isSupportedForLoanOrigination()` and
 * `isInvestmentPortfolioClass()` helpers in `types.ts`.
 *
 * **Why the other five classes are unsupported:**
 * - A bank does not "lend" to create equity or bonds — it invests in them (§5.1)
 * - Sovereign/sub-sovereign debt are government bonds, not loans (§5.9, §5.10)
 * - Securitisation packages existing loans into securities (§5.8)
 * - Use-of-proceeds inherits from the underlying asset (§5.7)
 * - Commercial real estate (§5.4) would require a separate loan category
 *
 * This explicit categorization satisfies IFRS S2 B62(a)(ii) requirement to disclose
 * which asset classes are included in financed emissions calculation and resolves
 * NFRS remediation backlog N1.8.
 */
export function assetClassForLoanCategory(
  category: LoanCategory | undefined,
): PcafAssetClass {
  switch (category) {
    case "retail-mortgage":
      // PCAF Part A 3rd Edition §5.5 — Mortgages (residential dwellings).
      return "mortgages";
    case "retail-vehicle":
      // PCAF Part A 3rd Edition §5.6 — Motor Vehicle Loans.
      return "motor-vehicle-loans";
    case "retail-personal":
    case "retail-education":
      // No matching Part A asset class — out of PCAF Cat. 15 scope.
      return "out-of-scope";
    case "commercial-project-finance":
    case "corporate-project-finance":
      // PCAF Part A 3rd Edition §5.3 — Project Finance.
      return "project-finance";
    case "commercial-term-loan":
    case "commercial-working-capital":
    case "corporate-syndicated":
    case "sme-working-capital":
    case "sme-trade-finance":
    case "sme-term-loan":
    case undefined:
      // PCAF Part A 3rd Edition §5.2 — Business Loans & Unlisted Equity.
      return "business-loans-unlisted-equity";
    default:
      return "business-loans-unlisted-equity";
  }
}

// ---------------------------------------------------------------------------
// Availability synthesizer — infer flags from the borrower catalog
// ---------------------------------------------------------------------------

/**
 * Infer PCAF data-availability flags for a borrower.  Used when the
 * `bfi_pcaf_availability` override table has no row for the borrower,
 * i.e. for the entire portfolio in the demo default.
 *
 * The synthesizer follows the R4 §8.2 realism map:
 *   - Climate TRACE facility match (cement, industrial, hospitality,
 *     logistics, waste in the 213-facility CT snapshot) or a GEM plant
 *     record → physical activity data available → Score 3.
 *   - Sector matches Global Cement Tracker (cement borrowers) → physical
 *     activity data available → Score 3.
 *   - Hydropower borrower has capacity (MW installed) → physical activity
 *     data available → Score 3 (Option 2b using installed capacity as
 *     the primary physical activity metric per §5.3 project scope).
 *   - Publicly-listed corporate borrower (NEPSE-listed cement / hydro) →
 *     revenue data available → Score 4.
 *   - Otherwise sector-average only → Score 5.
 *
 * The two published-emissions flags are NOT inferred. Nothing observable
 * here establishes whether a borrower publishes an assured GHG inventory, so
 * they default false and are set by verified document evidence instead — see
 * resolveAvailability() in evidence-matrix.ts. The demo seeds that evidence
 * (lib/demo/pcaf-evidence-seed.ts) to populate the top of the 1..5 histogram;
 * a live build seeds nothing and establishes the flags by real review.
 */
export function inferPcafAvailability(
  borrower: Borrower,
  loanCategory: LoanCategory | undefined,
): PcafDataAvailability {
  // Retail personal / education are out-of-scope regardless of borrower state.
  const outOfScope =
    loanCategory === "retail-personal" ||
    loanCategory === "retail-education" ||
    borrower.kind === "retail-pool";

  if (outOfScope) {
    return {
      borrower_publishes_verified: false,
      borrower_publishes_unverified: false,
      energy_consumption_data_available: false,
      physical_activity_data_available: false,
      revenue_data_available: false,
      sector_average_only: true,
      out_of_scope: true,
    };
  }

  // --- Published-emissions claims ---
  // Not inferable. These two flags start FALSE here and are established only by
  // a verified evidence document in resolveAvailability() (evidence-matrix.ts):
  // seeded in the demo (lib/demo/pcaf-evidence-seed.ts), reviewed by an officer
  // in a live build. Nothing in this module asserts them.
  const publishesVerified = false;
  const publishesUnverified = false;

  // --- Physical activity data ---
  // A facility match (either Climate TRACE, GCCT, or curated GEM entity)
  // means we can drive a physical-output-based emission calc (Option 2b).
  // For our demo, `borrower.facilities.length > 0` is the observable proxy.
  const sectorLower = borrower.nrbSector.toLowerCase();
  const isCement = sectorLower.includes("cement");
  const isHydro = sectorLower.includes("hydropower") || sectorLower.includes("hydro");
  const hasFacilityMatch = borrower.facilities.length > 0;
  const hasPhysicalActivity =
    // Cement → Global Cement Tracker capacity (Mt/yr).
    (isCement && hasFacilityMatch) ||
    // Hydro → installed capacity in MW (used with lifecycle CO₂e factors).
    (isHydro && hasFacilityMatch) ||
    // Any other facility-tier borrower with CT-matched emissions.
    (borrower.dataTier === "facility" && hasFacilityMatch);

  // --- Revenue data ---
  // Publicly-listed borrowers publish annual revenue, so we can drive an
  // Option 3a (revenue × sector-average EF) if physical output is missing.
  // For sector-benchmark borrowers with a synthesized EV proxy we treat
  // enterprise value > 0 as an approximation of "revenue is knowable" —
  // that is Score 4 (Option 3a) territory.
  const hasRevenueProxy =
    borrower.publiclyListed === true || borrower.evSource === "public-filing";

  return {
    borrower_publishes_verified: publishesVerified,
    borrower_publishes_unverified: publishesUnverified,
    energy_consumption_data_available: false,
    physical_activity_data_available: hasPhysicalActivity,
    revenue_data_available: hasRevenueProxy,
    // Score 5 is always a valid fallback — every loan can be attributed
    // to a sector average per unit of outstanding.  So this flag is `true`
    // for every non-out-of-scope loan.
    sector_average_only: true,
    out_of_scope: false,
  };
}

// ---------------------------------------------------------------------------
// Availability resolver — compose inferred + officer-saved overrides
// ---------------------------------------------------------------------------

/**
 * Merge an officer-saved `bfi_pcaf_availability` row on top of the
 * inferred flag bundle produced by {@link inferPcafAvailability}.
 *
 * The demo default is to infer the observable availability flags from the
 * borrower catalog (Climate TRACE match, publicly-listed flag) and raise the
 * two published-emissions flags from verified evidence documents (seeded in
 * the demo, none in a live build).  When an officer has reviewed the actual annual
 * report / assurance statement and persisted a row via the
 * `PCAF Data Availability` collection panel, those saved flags take
 * precedence per-flag.  Missing flags on the saved side fall through
 * to the inferred value (a `Partial<PcafDataAvailability>` shape is
 * supported so a partial-save from an older UI still composes cleanly).
 *
 * This is the composition point referenced by the P24 collection UI —
 * the workbench PCAF panel + `/api/pcaf/availability/[borrowerId]` both
 * flow through it so the score displayed and the score returned to
 * downstream consumers stay in sync.
 */
export function resolvePcafAvailability(
  inferred: PcafDataAvailability,
  saved: Partial<PcafDataAvailability> | null | undefined,
): PcafDataAvailability {
  if (!saved) return inferred;
  return {
    borrower_publishes_verified:
      saved.borrower_publishes_verified ?? inferred.borrower_publishes_verified,
    borrower_publishes_unverified:
      saved.borrower_publishes_unverified ??
      inferred.borrower_publishes_unverified,
    energy_consumption_data_available:
      saved.energy_consumption_data_available ??
      inferred.energy_consumption_data_available,
    physical_activity_data_available:
      saved.physical_activity_data_available ??
      inferred.physical_activity_data_available,
    revenue_data_available:
      saved.revenue_data_available ?? inferred.revenue_data_available,
    sector_average_only:
      saved.sector_average_only ?? inferred.sector_average_only,
    out_of_scope: saved.out_of_scope ?? inferred.out_of_scope,
  };
}

// ---------------------------------------------------------------------------
// Core decision tree
// ---------------------------------------------------------------------------

/**
 * Choose the option letter for a loan given the availability flags and
 * asset class.  This is the PCAF §5 decision tree in code form.
 *
 * The generic ladder (per §4 and §5.2/§5.3):
 *   verified reported (1a → Score 1)
 *     ↓
 *   unverified reported (1b → Score 2)
 *     ↓
 *   physical energy consumption × EF (2a → Score 3)
 *     ↓
 *   physical production × sector EF (2b → Score 3)
 *     ↓
 *   revenue × sector-average EF/revenue (3a → Score 4)
 *     ↓
 *   outstanding × sector-average EF/asset (3b → Score 5)
 *
 * Asset-class specialisations:
 *   §5.3 (Project Finance): same ladder as §5.2 but the numerator is the
 *   project's physical output (MW installed / GWh generated / tonnes
 *   produced) and the denominator is total project debt + equity.
 *   §5.5 (Mortgages) + §5.6 (Motor Vehicles): the ladder differs — see
 *   R4 §3.4 and §3.5 for the exact per-score data requirements.  For
 *   the demo we simplify to Score 5 (Option 3b) unless the flag set
 *   explicitly says otherwise.
 */
function chooseOption(
  availability: PcafDataAvailability,
  assetClass: PcafAssetClass,
): PcafOption {
  // Retail vehicles + mortgages: PCAF has a distinct rubric per §5.5
  // and §5.6.  In the demo we don't yet capture floor area / kWh meters
  // / vehicle make-model at scale, so we route these to the sector-
  // average tier (Option 3b → Score 5).  A future extension can wire
  // per-property EPC labels (§5.5) or vehicle make/model + km driven
  // (§5.6) through the same availability shape.
  if (assetClass === "mortgages" || assetClass === "motor-vehicle-loans") {
    return "3b";
  }

  // Business Loans (§5.2) / Project Finance (§5.3) / Listed Equity (§5.1)
  // all follow the same option ladder — differences are in the denominator
  // (EVIC vs. balance-sheet vs. total project cost), not in the score
  // rubric itself.  See R4 §3.2 and §3.3.
  if (availability.borrower_publishes_verified) return "1a";
  if (availability.borrower_publishes_unverified) return "1b";
  if (availability.energy_consumption_data_available) return "2a";
  if (availability.physical_activity_data_available) return "2b";
  if (availability.revenue_data_available) return "3a";
  return "3b";
}

// ---------------------------------------------------------------------------
// Method + citation description
// ---------------------------------------------------------------------------

function methodDescription(
  option: PcafOption,
  assetClass: PcafAssetClass,
  borrower: Borrower,
): { method: string; dataSource: string } {
  const sectorLower = borrower.nrbSector.toLowerCase();
  const isHydro = sectorLower.includes("hydropower") || sectorLower.includes("hydro");

  switch (option) {
    case "1a":
      return {
        method:
          "Borrower publishes GHG-Protocol-conformant scope 1/2/3 emissions with third-party verification",
        dataSource: `${borrower.name} annual report + third-party assurance`,
      };
    case "1b":
      return {
        method:
          "Borrower publishes GHG-Protocol-conformant scope 1/2/3 emissions (unverified)",
        dataSource: `${borrower.name} annual report`,
      };
    case "2a":
      return {
        method:
          "Borrower's primary energy consumption (kWh, litres, therms) × source-specific emission factor",
        dataSource: "Utility bill / fuel purchase records",
      };
    case "2b":
      if (assetClass === "project-finance" && isHydro) {
        return {
          method:
            "Project installed capacity (MW) × lifecycle CO₂e factor (~15 tCO₂e/MW/yr, run-of-river typical)",
          dataSource: "Curated Nepal hydropower operator registry (capacity + facility)",
        };
      }
      if (sectorLower.includes("cement")) {
        return {
          method:
            "Facility production tonnage × sector emission factor (~0.75 tCO2 / tonne cement)",
          dataSource: "Climate TRACE Nepal 2024 + Global Cement and Concrete Tracker",
        };
      }
      return {
        method:
          "Borrower's primary physical production data × sector emission factor",
        dataSource: "Climate TRACE Nepal 2024 facility emissions",
      };
    case "3a":
      return {
        method:
          "Borrower revenue × sector-average emission factor per unit of revenue",
        dataSource: "NEPSE filings + EDGAR sector intensity (South Asia)",
      };
    // Terminal rung — the sector-average fallback. `chooseOption` produces
    // "3b" here; "3c" (asset-turnover proxy) is a valid PcafOption value the
    // type + SCORE_FOR_OPTION + PCAF_OPTION_LABEL carry, but the §5 decision
    // tree in chooseOption() never routes to it (no availability-flag
    // combination yields "3c"). Both collapse to the same Score-5 sector-
    // average method, so this is a single `default` case rather than separate
    // `case "3b"` / `case "3c"` labels: that keeps the switch exhaustive for
    // the type-checker AND leaves no unreachable `case "3c"` branch for the
    // P1.5 100%-branch gate to trip on. The 3c→Score-5 collapse itself is
    // still asserted via SCORE_FOR_OPTION in
    // tests/unit/pcaf-scoring.unit.test.ts.
    default:
      return {
        method:
          "Outstanding amount × sector-average emission factor per unit of asset",
        dataSource: "EDGAR sector-average intensity (Nepal / South Asia)",
      };
  }
}

function buildCitation(option: PcafOption, assetClass: PcafAssetClass): string {
  const section = PCAF_ASSET_CLASS_SECTION[assetClass];
  const optionLabel = PCAF_OPTION_LABEL[option];
  return `PCAF Part A 3rd Edition ${section} · ${optionLabel}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the per-loan PCAF data-quality score.
 *
 * `facilityData` is a placeholder for future extensions (per-property
 * floor area for §5.5 mortgages, per-vehicle make/model for §5.6, etc.).
 * The current demo does not populate it; the rubric collapses to Score 5
 * (Option 3b) for §5.5 / §5.6 asset classes without more inputs.
 *
 * The returned {@link PcafComputationResult} is safe to embed in the
 * `PcafAttribution` shape as optional `pcafOption` / `pcafCitation`
 * fields — see `lib/data/portfolio.ts` for the wire-in.
 *
 * **Validation:** Only asset classes supported for loan origination are accepted.
 * Investment portfolio classes (`listed-equity-corporate-bonds`, `sovereign-debt`,
 * etc.) will throw an error — they require separate calculation logic per PCAF
 * Part A §5.1, §5.7–§5.10.
 *
 * @throws {Error} if `assetClass` is an investment portfolio class (not supported
 *   for loan origination financed emissions)
 */
export function computePcafScore(
  loan: Loan,
  borrower: Borrower,
  facilityData: null | undefined | Record<string, unknown>,
  availability: PcafDataAvailability,
  assetClass: PcafAssetClass,
): PcafComputationResult {
  // Explicit out-of-scope short-circuit — retail personal / education.
  if (availability.out_of_scope || assetClass === "out-of-scope") {
    return {
      score: 5,
      option: "3b",
      method: "Not in scope for PCAF Cat. 15",
      dataSource: "n/a",
      citation: "PCAF Part A 3rd Edition §5 — asset class not in Part A scope",
      assetClass: "out-of-scope",
    };
  }

  // Validate asset class is supported for loan origination.
  // Investment portfolio classes (equity holdings, sovereign bonds, securitized
  // products) are explicitly unsupported per N1.8 — they require separate
  // calculation logic per PCAF Part A §5.1, §5.7–§5.10.
  if (!isSupportedForLoanOrigination(assetClass)) {
    throw new Error(
      `Asset class "${assetClass}" is not supported for loan origination financed emissions. ` +
        `This class applies to investment portfolios (equity/bond holdings, sovereign debt, ` +
        `securitized products) and requires separate calculation per PCAF Part A §5.1, §5.7–§5.10. ` +
        `Loan origination supports: business-loans-unlisted-equity, project-finance, mortgages, ` +
        `motor-vehicle-loans, out-of-scope. See isSupportedForLoanOrigination() and ` +
        `isInvestmentPortfolioClass() in lib/regulatory/pcaf/types.ts.`
    );
  }

  const option = chooseOption(availability, assetClass);
  const score: PcafScore = SCORE_FOR_OPTION[option];
  const { method, dataSource } = methodDescription(option, assetClass, borrower);
  const citation = buildCitation(option, assetClass);

  return {
    score,
    option,
    method,
    dataSource,
    citation,
    assetClass,
  };
}

// Re-export helpers so downstream code can import them from one module.
export { PCAF_ASSET_CLASS_SECTION, PCAF_OPTION_LABEL } from "./types";
