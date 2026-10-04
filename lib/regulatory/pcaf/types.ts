/**
 * PCAF (Partnership for Carbon Accounting Financials) types.
 *
 * Encodes the data-quality-score rubric from
 * *The Global GHG Accounting and Reporting Standard, Part A: Financed
 * Emissions* — Third Edition (Dec 2025, release 15 Jan 2026).
 *
 * The source-of-truth reference used to derive the enum values and
 * scoring rubric is `research/04-pcaf-scoring.md` (research pack R4).
 *
 * The 3rd edition covers ten asset classes (six originals + four added
 * in 2025). For the Jana Nepal demo the practically relevant classes
 * are Business Loans (§5.2), Project Finance (§5.3), Commercial Real
 * Estate (§5.4), Mortgages (§5.5) and Motor Vehicle Loans (§5.6);
 * the remaining classes are included here so a future extension can
 * map to them without a schema change.
 */

// ---------------------------------------------------------------------------
// Asset classes — PCAF Part A 3rd Edition §5.1-§5.10
// ---------------------------------------------------------------------------

/** PCAF Part A 3rd Edition §5 — ten asset classes. */
export type PcafAssetClass =
  /** §5.1 — Listed equity & corporate bonds (public issuers, general corporate purposes). */
  | "listed-equity-corporate-bonds"
  /** §5.2 — Business loans & unlisted equity (private issuers, general corporate purposes). */
  | "business-loans-unlisted-equity"
  /** §5.3 — Project finance (self-contained project with defined budget). */
  | "project-finance"
  /** §5.4 — Commercial real estate (non-residential CRE, no operational control). */
  | "commercial-real-estate"
  /** §5.5 — Mortgages (residential dwellings). */
  | "mortgages"
  /** §5.6 — Motor vehicle loans (consumer or business, one or more vehicles). */
  | "motor-vehicle-loans"
  /** §5.7 — Use-of-proceeds structures (added 3rd ed. — inherits from underlying asset class). */
  | "use-of-proceeds-structures"
  /** §5.8 — Securitisation & structured products (added 3rd ed. — inherits from underlying pool). */
  | "securitisation-structured-products"
  /** §5.9 — Sovereign debt. */
  | "sovereign-debt"
  /** §5.10 — Sub-sovereign debt (added 3rd ed. — states, provinces, cities, municipalities). */
  | "sub-sovereign-debt"
  /**
   * Not-in-scope for PCAF Cat.15 (e.g. retail personal / education loans that
   * do not map to §5.5 mortgages or §5.6 motor vehicles). Kept as an explicit
   * value so callers can distinguish "no data" from "correctly out of scope".
   */
  | "out-of-scope";

// ---------------------------------------------------------------------------
// Score + Option enums
// ---------------------------------------------------------------------------

/**
 * PCAF data-quality score.  1 = highest quality (verified borrower emissions),
 * 5 = lowest quality (sector-average per unit of asset).  See §4 and §5.
 */
export type PcafScore = 1 | 2 | 3 | 4 | 5;

/**
 * PCAF option letter per §4 hierarchy:
 *   Option 1a — verified reported emissions            → Score 1
 *   Option 1b — unverified reported emissions          → Score 2
 *   Option 2a — physical energy-consumption × EF       → Score 3
 *   Option 2b — physical production data × sector EF   → Score 3
 *   Option 3a — revenue × sector-average EF/revenue    → Score 4
 *   Option 3b — outstanding × sector-average EF/asset  → Score 5
 *   Option 3c — revenue estimated via asset-turnover × EF/asset → Score 5
 */
export type PcafOption = "1a" | "1b" | "2a" | "2b" | "3a" | "3b" | "3c";

/** Score ↔ Option collapse per PCAF §4 (see R4 §3.1). */
export const SCORE_FOR_OPTION: Record<PcafOption, PcafScore> = {
  "1a": 1,
  "1b": 2,
  "2a": 3,
  "2b": 3,
  "3a": 4,
  "3b": 5,
  "3c": 5,
};

// ---------------------------------------------------------------------------
// Data-availability flags (per loan / borrower)
// ---------------------------------------------------------------------------

/**
 * Fine-grained flags describing which PCAF data ladders are usable for a
 * specific loan.  Each flag can be sourced from
 *
 *   1. A manual override row in `bfi_pcaf_availability` (analyst has looked
 *      at the borrower's most recent annual report and confirmed).
 *   2. A synthesizer (`inferPcafAvailability`) that inspects the borrower
 *      catalog: whether Climate TRACE covers the facility, whether the
 *      sector maps to Global Cement Tracker / EDGAR intensity, etc.
 *
 * All flags default to `false` when unknown — Score 5 (Option 3b) is the
 * PCAF-required fallback per §5.2 rubric.
 */
export type PcafDataAvailability = {
  /**
   * Borrower publishes GHG-Protocol-conformant scope 1/2/3 emissions AND
   * they are third-party verified.  Route to Option 1a → Score 1.
   */
  borrower_publishes_verified: boolean;
  /**
   * Borrower publishes GHG-Protocol-conformant scope 1/2/3 emissions but
   * they are self-reported (unverified).  Route to Option 1b → Score 2.
   */
  borrower_publishes_unverified: boolean;
  /**
   * Bank captures the borrower's primary energy consumption
   * (kWh, litres of fuel, therms, etc.) that can be multiplied by an
   * energy-source-specific emission factor.  Route to Option 2a → Score 3.
   */
  energy_consumption_data_available: boolean;
  /**
   * Bank captures the borrower's primary physical production or output
   * data (tonnes of cement, MWh generated, MW installed capacity, etc.)
   * that can be multiplied by a sector emission factor.  Route to
   * Option 2b → Score 3.  For the Nepal demo, this is what Climate TRACE
   * facility matching and the Global Cement Tracker unlock.
   */
  physical_activity_data_available: boolean;
  /**
   * Bank captures the borrower's revenue and there is a sector-average
   * emission factor per unit of revenue for the borrower's sector.
   * Route to Option 3a → Score 4.
   */
  revenue_data_available: boolean;
  /**
   * Fallback — the only usable input is a sector-average emission factor
   * per unit of outstanding asset.  Route to Option 3b → Score 5.
   * This flag is effectively "always true" and is present so callers
   * can express "sector average only, no revenue detail".
   */
  sector_average_only: boolean;
  /**
   * Loan is not in scope for PCAF Cat. 15 (e.g. retail personal /
   * education loans; interbank exposures where separate reporting is
   * recommended per §5.1).  Suppresses score computation entirely.
   */
  out_of_scope?: boolean;
};

// ---------------------------------------------------------------------------
// Computation result
// ---------------------------------------------------------------------------

/**
 * The output of a per-loan PCAF score computation.
 *
 * `citation` points at the specific PCAF paragraph(s) that justify the
 * score — this is what an auditor needs to see next to the number in a
 * disclosure.  Format:
 *   "PCAF Part A 3rd Edition §5.2 · Option 2b (physical production × sector EF)"
 */
export type PcafComputationResult = {
  score: PcafScore;
  option: PcafOption;
  /** Human-readable method summary — used as `qualityNote` in the UI. */
  method: string;
  /** Data source lineage that made this score achievable (short form). */
  dataSource: string;
  /** PCAF paragraph citation — surfaced in tooltips + auditor exports. */
  citation: string;
  /** Asset class that was used to route the computation. */
  assetClass: PcafAssetClass;
};

// ---------------------------------------------------------------------------
// Asset-class helper
// ---------------------------------------------------------------------------

/**
 * Static short-form section number for each asset class — used to build
 * citations without having to look up the (long) PDF page number.
 */
export const PCAF_ASSET_CLASS_SECTION: Record<PcafAssetClass, string> = {
  "listed-equity-corporate-bonds": "§5.1",
  "business-loans-unlisted-equity": "§5.2",
  "project-finance": "§5.3",
  "commercial-real-estate": "§5.4",
  mortgages: "§5.5",
  "motor-vehicle-loans": "§5.6",
  "use-of-proceeds-structures": "§5.7",
  "securitisation-structured-products": "§5.8",
  "sovereign-debt": "§5.9",
  "sub-sovereign-debt": "§5.10",
  "out-of-scope": "n/a (out of PCAF Cat. 15 scope)",
};

/** Human-readable asset-class label used in UI + reports. */
export const PCAF_ASSET_CLASS_LABEL: Record<PcafAssetClass, string> = {
  "listed-equity-corporate-bonds": "Listed Equity & Corporate Bonds",
  "business-loans-unlisted-equity": "Business Loans & Unlisted Equity",
  "project-finance": "Project Finance",
  "commercial-real-estate": "Commercial Real Estate",
  mortgages: "Mortgages",
  "motor-vehicle-loans": "Motor Vehicle Loans",
  "use-of-proceeds-structures": "Use-of-Proceeds Structures",
  "securitisation-structured-products": "Securitisation & Structured Products",
  "sovereign-debt": "Sovereign Debt",
  "sub-sovereign-debt": "Sub-Sovereign Debt",
  "out-of-scope": "Out of scope",
};

/** Human-readable label for a single option letter. */
export const PCAF_OPTION_LABEL: Record<PcafOption, string> = {
  "1a": "Option 1a — verified reported emissions (GHG Protocol)",
  "1b": "Option 1b — unverified reported emissions (GHG Protocol)",
  "2a": "Option 2a — primary energy-consumption × source-specific EF",
  "2b": "Option 2b — primary physical production × sector EF",
  "3a": "Option 3a — revenue × sector-average EF/revenue",
  "3b": "Option 3b — outstanding × sector-average EF/asset",
  "3c": "Option 3c — asset-turnover × sector-average EF/asset",
};

// ---------------------------------------------------------------------------
// Asset-class categorization — Loan Origination vs. Investment Portfolio
// ---------------------------------------------------------------------------

/**
 * PCAF asset classes that apply to **loan origination** portfolios (the lending book).
 * These are the classes that a commercial bank's credit department originates.
 *
 * Per IFRS S2 B62(a)(ii) and PCAF Part A §5, financed emissions for the **lending
 * portfolio** use these five classes. A Nepal commercial bank's loan book contains:
 * - Business loans to corporates/SMEs (§5.2)
 * - Project finance for infrastructure/hydropower (§5.3)
 * - Residential mortgages (§5.5)
 * - Motor vehicle loans (§5.6)
 * - Out-of-scope retail personal/education loans
 */
export const LOAN_ORIGINATION_ASSET_CLASSES: ReadonlySet<PcafAssetClass> = new Set([
  "business-loans-unlisted-equity", // §5.2 — SME, commercial, corporate loans
  "project-finance", // §5.3 — Infrastructure, hydropower, self-contained projects
  "mortgages", // §5.5 — Residential real estate loans
  "motor-vehicle-loans", // §5.6 — Consumer/business vehicle financing
  "out-of-scope", // Retail personal/education (not in PCAF Cat. 15)
]);

/**
 * PCAF asset classes that apply to **investment portfolios** (asset management,
 * treasury holdings, securities portfolios). These are classes for equity/bond
 * **holdings** that a bank invests in, not loans that a bank originates.
 *
 * A commercial bank's **lending book** does not originate these; they appear only
 * in the **investment portfolio** (treasury, asset management). Per PCAF Part A §5,
 * financed emissions for investment portfolios use §5.1 (listed equity/bonds),
 * §5.7 (green bonds), §5.8 (securitized products), §5.9 (sovereign debt), and
 * §5.10 (sub-sovereign debt).
 *
 * **Why these are not supported for loan origination:**
 * - A bank does not "lend" to create equity or bonds — it invests in them (§5.1)
 * - Sovereign/sub-sovereign debt are government bonds, not loans originated to
 *   borrowers (§5.9, §5.10)
 * - Securitisation is packaging of existing loans into securities (§5.8)
 * - Use-of-proceeds structures inherit their class from the underlying asset (§5.7)
 * - Commercial real estate (§5.4) would apply if Nepal banks had non-residential
 *   CRE loans as a separate category, but current loan categories route CRE to
 *   §5.2 business loans
 */
export const INVESTMENT_PORTFOLIO_ASSET_CLASSES: ReadonlySet<PcafAssetClass> = new Set([
  "listed-equity-corporate-bonds", // §5.1 — Public equity/bond holdings
  "commercial-real-estate", // §5.4 — Non-residential CRE (not in Nepal loan categories)
  "use-of-proceeds-structures", // §5.7 — Green bonds, sustainability-linked (inherit from underlying)
  "securitisation-structured-products", // §5.8 — Securitized asset pools
  "sovereign-debt", // §5.9 — Government bond holdings
  "sub-sovereign-debt", // §5.10 — Municipal/provincial bond holdings
]);

/**
 * Check if a PCAF asset class is supported for **loan origination** portfolios.
 *
 * Returns `true` for classes that apply to a commercial bank's lending book
 * (business loans, project finance, mortgages, vehicle loans, out-of-scope retail).
 * Returns `false` for investment portfolio classes (equity holdings, sovereign bonds,
 * securitized products) that do not represent loans originated by the bank.
 *
 * **Usage:** Validate that asset classes used in financed emissions calculations
 * for the lending portfolio are appropriate. Investment portfolio classes require
 * separate calculation logic per PCAF Part A §5.1, §5.8, §5.9, §5.10.
 */
export function isSupportedForLoanOrigination(assetClass: PcafAssetClass): boolean {
  return LOAN_ORIGINATION_ASSET_CLASSES.has(assetClass);
}

/**
 * Check if a PCAF asset class applies to **investment portfolios** (not loan origination).
 *
 * Returns `true` for equity/bond holdings, sovereign debt, and other securities that
 * a bank invests in rather than originates as loans. These require separate financed
 * emissions calculation per PCAF Part A §5.1, §5.7–§5.10 and are out of scope for
 * the lending book disclosure.
 */
export function isInvestmentPortfolioClass(assetClass: PcafAssetClass): boolean {
  return INVESTMENT_PORTFOLIO_ASSET_CLASSES.has(assetClass);
}
