/**
 * BFI Demo - Financed Emissions Types
 *
 * Models the loan officer view: loans on the left, matched Climate TRACE
 * facilities on the right, PCAF attribution calculation connecting them.
 *
 * Extended for the three-tier dashboard (ESRM / Taxonomy / NFRS) on top of
 * a full ~80K-loan synthesized portfolio rooted in real Nepal entities.
 */

export type StatusKind = "live" | "mock";

// ---------------------------------------------------------------------------
// Loan categorisation
// ---------------------------------------------------------------------------

/**
 * Loan category - drives portfolio funnel scoping.
 * `retail-*` and `sme-*` are typically out-of-scope for facility-level PCAF.
 * `commercial-*` and `corporate-*` are where facility data attaches.
 */
export type LoanCategory =
  | "retail-mortgage"
  | "retail-personal"
  | "retail-education"
  | "retail-vehicle"
  | "sme-working-capital"
  | "sme-trade-finance"
  | "sme-term-loan"
  | "commercial-term-loan"
  | "commercial-working-capital"
  | "commercial-project-finance"
  | "corporate-syndicated"
  | "corporate-project-finance";

export type BusinessUnit =
  | "Retail"
  | "SME"
  | "Corporate"
  | "Project Finance";

export type Branch = {
  code: string;
  name: string;
  city: string;
  province: string;
};

/**
 * The PCAF-relevant data tier a borrower qualifies for.
 * Climate TRACE match = facility (best). Sector benchmark = EDGAR-derived.
 * Revenue estimate = national sector averages. n/a = retail / out-of-scope.
 */
export type BorrowerDataTier =
  | "facility"
  | "sector-benchmark"
  | "revenue-estimate"
  | "n/a";

export type BorrowerKind = "corporate" | "sme" | "retail-pool";

// ---------------------------------------------------------------------------
// Borrower and facility matching
// ---------------------------------------------------------------------------

/** A Climate TRACE facility matched to a bank borrower */
export type MatchedFacility = {
  /** Climate TRACE asset ID or GEM plant ID */
  assetId: string;
  /** Facility name (English) */
  facilityName: string;
  /** Local-language name (Nepali, etc.) */
  facilityNameLocal?: string | null;
  /** Climate TRACE / sector name (e.g. "power", "manufacturing") */
  sector: string;
  /** Latitude */
  lat: number;
  /** Longitude */
  lng: number;
  /** Total annual CO2e in tonnes (most recent year) */
  annualCo2eTonnes: number;
  /** Year of the most-recent emissions figure */
  emissionsYear: number;
  /**
   * Scope 1 emissions (direct, from owned/controlled sources) in CO2e tonnes.
   * Per IFRS S2 B62(a), financed emissions must be disaggregated by Scope 1/2/3.
   * Optional - undefined when scope-level data is not available from the data source.
   * Climate TRACE provides total emissions only; GHG Protocol inventories may provide scopes.
   */
  scope1Co2eTonnes?: number;
  /**
   * Scope 2 emissions (indirect, from purchased electricity/heat) in CO2e tonnes.
   * Optional - undefined when scope-level data is not available.
   */
  scope2Co2eTonnes?: number;
  /**
   * Scope 3 emissions (other indirect, supply chain etc.) in CO2e tonnes.
   * Optional - undefined when scope-level data is not available.
   */
  scope3Co2eTonnes?: number;
  /** Optional multi-year time series for NFRS trend disclosure */
  emissionsByYear?: { year: number; co2eTonnes: number }[];
  /** Geographic context */
  municipality?: string | null;
  subnationalUnit?: string | null;
  /** Cement-only enrichment from GCCT */
  cementCapacityMtpa?: number | null;
  /** GEM plant ID if available */
  gemPlantId?: string | null;
  /** GEM wiki page if available */
  wikiPage?: string | null;
  /** How the match was made */
  matchMethod: "manual" | "name-match" | "geocoded";
  /** Confidence in the match (0-1) */
  matchConfidence: number;
};

/** A bank borrower with one or more matched facilities */
export type Borrower = {
  id: string;
  name: string;
  kind?: BorrowerKind;
  /** NRB sector classification */
  nrbSector: string;
  /**
   * GICS 6-digit industry code for IFRS S2 B62(a)(i) compliance.
   * Per IFRS S2 Climate-related Disclosures (June 2023) §B62(a)(i), entity shall
   * use GICS to identify the industry to which a counterparty belongs. Derived
   * from `nrbSector` via the NRB→GICS mapping table. Optional - when undefined,
   * the borrower's NRB sector has no GICS mapping (e.g., unmapped legacy data).
   */
  gicsCode?: string;
  /** Estimated enterprise value in USD (for PCAF attribution) */
  enterpriseValueUsd: number;
  /** Source of the enterprise value estimate */
  evSource: "public-filing" | "estimated" | "proxy";
  /**
   * Total equity (USD) from borrower's balance sheet.
   * Per PCAF Part A 3rd Edition §5.2, the attribution denominator for business
   * loans to unlisted companies is total equity + total debt (balance-sheet
   * basis, not market values). Optional - when undefined, falls back to
   * enterpriseValueUsd per PCAF-permitted fallback (§4.2: "Fallback allowed to
   * total balance sheet (assets) if debt/equity split not obtainable").
   */
  totalEquityUsd?: number;
  /**
   * Total debt (USD) from borrower's balance sheet.
   * Per PCAF Part A 3rd Edition §5.2, the attribution denominator for business
   * loans to unlisted companies is total equity + total debt. Optional - when
   * undefined, falls back to enterpriseValueUsd.
   */
  totalDebtUsd?: number;
  /** PCAF data tier this borrower qualifies for */
  dataTier?: BorrowerDataTier;
  /** Parent / ultimate owner if known */
  parent?: string | null;
  parentEntityId?: string | null;
  /** GEM entity ID if known */
  gemEntityId?: string | null;
  publiclyListed?: boolean;
  /** Headquarters / primary facility city */
  municipality?: string | null;
  subnationalUnit?: string | null;
  /** Matched Climate TRACE / GCCT facilities */
  facilities: MatchedFacility[];
  /** Total emissions across all matched facilities (most recent year) */
  totalCo2eTonnes: number;
  /**
   * Scope 1 emissions (direct) for this borrower in CO2e tonnes.
   * Per IFRS S2 B62(a), financed emissions must be disaggregated by Scope 1/2/3.
   * Optional - when undefined, scope split is not available. Aggregated from facilities
   * when available, or from borrower-provided GHG Protocol inventory.
   */
  scope1Co2eTonnes?: number;
  /**
   * Scope 2 emissions (indirect, purchased energy) for this borrower in CO2e tonnes.
   * Optional - when undefined, scope split is not available.
   */
  scope2Co2eTonnes?: number;
  /**
   * Scope 3 emissions (other indirect) for this borrower in CO2e tonnes.
   * Optional - when undefined, scope split is not available.
   */
  scope3Co2eTonnes?: number;
};

// ---------------------------------------------------------------------------
// Loans
// ---------------------------------------------------------------------------

export type LoanStatus =
  | "active"
  | "disbursed"
  | "under-review"
  | "approved"
  | "declined";

export type NrbTaxonomyColor = "green" | "amber" | "red" | "unclassified";

export type Loan = {
  id: string;
  /** Borrower reference */
  borrowerId: string;
  /** Loan product name (human-readable) */
  product: string;
  /** Machine-readable loan category */
  category?: LoanCategory;
  /** Business unit (for portfolio segmentation) */
  businessUnit?: BusinessUnit;
  /** Branch that originated the loan */
  branch?: string;
  branchCode?: string;
  /** Outstanding amount in NPR */
  outstandingNpr: number;
  /** Outstanding amount in USD (for PCAF calc) */
  outstandingUsd: number;
  /**
   * Loss allowance (impairment provision) in USD.
   * Per IFRS S2 B62(b), gross exposure = funded carrying amount before loss allowance.
   * Gross exposure = outstandingUsd + lossAllowance.
   * Undefined in live until the bank provides it; demo seeds ~2% of outstanding.
   */
  lossAllowance?: number;
  /**
   * Risk mitigant value (collateral, guarantees, credit insurance) in USD.
   * Per IFRS S2 B62(c)(ii), entity shall disclose whether risk mitigants have been
   * excluded from gross exposure. When provided:
   * Gross exposure = outstandingUsd + lossAllowance - riskMitigantValueUsd.
   * Undefined in live until the bank provides it; demo seeds collateral on ~30% of loans.
   */
  riskMitigantValueUsd?: number;
  /**
   * Undrawn loan commitment (approved but not yet disbursed) in USD.
   * Per IFRS S2 B62(a)(ii), asset classes shall include undrawn loan commitments.
   * Per B62(c)(iii), entity shall disclose whether undrawn commitments are included
   * in financed emissions calculation. Undrawn commitments are NOT funded, so they
   * are excluded from gross exposure (which is funded carrying amount per B62(b)),
   * but must be tracked and disclosed separately.
   * Undefined in live until the bank provides it; demo seeds undrawn on ~20% of loans.
   */
  undrawnCommitmentUsd?: number;
  /**
   * Total project cost (USD) for project finance loans.
   * Per PCAF Part A 3rd Edition §5.3, the attribution denominator for project
   * finance is total project equity + total project debt, which equals total
   * project cost for greenfield projects. Optional - applies only to §5.3
   * project-finance asset class. When undefined, falls back to borrower's
   * enterpriseValueUsd (the project SPV's total value).
   */
  projectCostUsd?: number;
  /**
   * Property value at loan origination (USD) for commercial real estate and mortgages.
   * Per PCAF Part A 3rd Edition §5.4 (CRE) and §5.5 (Mortgages), the attribution
   * denominator is property value at origination. Optional - applies only to §5.4/§5.5
   * asset classes. When undefined, falls back to borrower's enterpriseValueUsd.
   */
  propertyValueUsd?: number;
  /**
   * Vehicle value at origination (USD) for motor vehicle loans.
   * Per PCAF Part A 3rd Edition §5.6, the attribution denominator is total vehicle
   * value at origination (purchase price). Optional - applies only to §5.6 motor-vehicle
   * asset class. When undefined, falls back to borrower's enterpriseValueUsd.
   */
  vehicleValueUsd?: number;
  /** Disbursement date (ISO 8601) */
  disbursedDate: string;
  /** Maturity date (ISO 8601) */
  maturityDate: string;
  /** Loan status */
  status: LoanStatus;
  /** NRB Green Finance Taxonomy classification */
  nrbTaxonomy: NrbTaxonomyColor;
  /** Purpose / use of proceeds */
  purpose: string;
};

// ---------------------------------------------------------------------------
// PCAF calculation
// ---------------------------------------------------------------------------

export type PcafMethodology =
  | "facility-attributed"     // Score 2 - CT facility + public EV
  | "satellite-emissions"     // Score 3 - CT facility + estimated EV
  | "sector-benchmark"        // Score 4 - EDGAR sector intensity
  | "revenue-based-estimate"  // Score 5 - national sector average
  | "out-of-scope";           // retail - not in financed emissions scope

/** PCAF Scope 3 Category 15 - financed emissions attribution */
export type PcafAttribution = {
  loanId: string;
  borrowerId: string;
  methodology?: PcafMethodology;
  /** Attribution factor = outstanding / enterprise value */
  attributionFactor: number;
  /** Attributed emissions = attribution factor x borrower total emissions */
  attributedCo2eTonnes: number;
  /**
   * Attributed Scope 1 emissions in CO2e tonnes.
   * Per IFRS S2 B62(a), financed emissions must be disaggregated by Scope 1/2/3.
   * Optional - when undefined, scope split is not available for this attribution.
   * Calculated as: attributionFactor × borrower.scope1Co2eTonnes
   */
  attributedScope1Co2eTonnes?: number;
  /**
   * Attributed Scope 2 emissions in CO2e tonnes.
   * Optional - when undefined, scope split is not available.
   */
  attributedScope2Co2eTonnes?: number;
  /**
   * Attributed Scope 3 emissions in CO2e tonnes.
   * Optional - when undefined, scope split is not available.
   */
  attributedScope3Co2eTonnes?: number;
  /** PCAF data quality score (1=best, 5=worst) */
  dataQualityScore: 1 | 2 | 3 | 4 | 5;
  /** Explanation of the quality score */
  qualityNote: string;
  /**
   * PCAF option letter (1a, 1b, 2a, 2b, 3a, 3b, 3c) per §4/§5 rubric.
   * Populated by `lib/regulatory/pcaf/scoring.ts` compute engine.
   */
  pcafOption?: "1a" | "1b" | "2a" | "2b" | "3a" | "3b" | "3c";
  /**
   * PCAF Part A 3rd Edition §5.x asset class this loan was routed to.
   * See `lib/regulatory/pcaf/types.ts` for the enum.
   */
  pcafAssetClass?:
    | "listed-equity-corporate-bonds"
    | "business-loans-unlisted-equity"
    | "project-finance"
    | "commercial-real-estate"
    | "mortgages"
    | "motor-vehicle-loans"
    | "use-of-proceeds-structures"
    | "securitisation-structured-products"
    | "sovereign-debt"
    | "sub-sovereign-debt"
    | "out-of-scope";
  /**
   * Attribution denominator type used for this loan (N1.9).
   * Per PCAF Part A §5, different asset classes use different denominators:
   * equity+debt (§5.2), project-cost (§5.3), property-value (§5.5), etc.
   * Used to display correct formula in UI hints ("Outstanding ÷ Equity + Debt").
   */
  denominatorType?:
    | "equity-plus-debt"
    | "project-cost"
    | "property-value"
    | "vehicle-value"
    | "enterprise-value"
    | "out-of-scope";
  /**
   * Human-readable attribution formula label for UI hints (N1.9).
   * Example: "Outstanding ÷ (Equity + Debt)" or "Outstanding ÷ Total Project Cost"
   */
  denominatorLabel?: string;
  /**
   * PCAF paragraph citation — surfaced in tooltips + auditor exports.
   * Format: "PCAF Part A 3rd Edition §5.2 · Option 2b (physical production × sector EF)"
   */
  pcafCitation?: string;
  /** Data source lineage that unlocked this score. */
  pcafDataSource?: string;
};

// ---------------------------------------------------------------------------
// Portfolio summary
// ---------------------------------------------------------------------------

export type TaxonomyBreakdown = {
  green: number;
  amber: number;
  red: number;
  unclassified: number;
};

export type PortfolioFunnel = {
  totalLoans: number;
  inScopeLoans: number;
  facilityMatchedLoans: number;
  /** Count of unique borrowers with facility-tier data appearing in the loan book */
  facilityMatchedBorrowers: number;
  totalOutstandingNpr: number;
  inScopeOutstandingNpr: number;
  facilityMatchedOutstandingNpr: number;
};

export type DataQualityDistribution = Array<{
  score: 1 | 2 | 3 | 4 | 5;
  loanCount: number;
  outstandingUsd: number;
  outstandingNpr: number;
  attributedCo2eTonnes: number;
}>;

export type PortfolioTrendPoint = {
  year: number;
  totalAttributedCo2eTonnes: number;
  byTaxonomy: TaxonomyBreakdown;
};

/**
 * Methodology disclosure per IFRS S2 B62(d) and §29(a)(iii).
 *
 * Per IFRS S2 Climate-related Disclosures (June 2023) §B62(d), entity shall disclose
 * the **methodology** used to measure financed emissions, including the allocation method.
 * Per §29(a)(iii), entity shall disclose the measurement approach, inputs, assumptions,
 * and estimation techniques used, and the changes to those approaches with reasons.
 *
 * This replaces the hardcoded `pcafMethodologyNote` strings (N1.10) with structured
 * disclosure showing which PCAF options, denominators, and data sources were used
 * across the portfolio, both in count and weighted by emissions/exposure.
 */
export type MethodologyDisclosure = {
  /**
   * Breakdown by PCAF option (1a/1b/2a/2b/3a/3b/3c).
   * Shows distribution of data quality approaches across the portfolio.
   */
  byOption: Array<{
    option: "1a" | "1b" | "2a" | "2b" | "3a" | "3b" | "3c";
    loanCount: number;
    percentOfLoans: number;
    outstandingUsd: number;
    percentOfExposure: number;
    attributedCo2eTonnes: number;
    percentOfEmissions: number;
  }>;
  /**
   * Breakdown by attribution denominator type (N1.9).
   * Shows which PCAF §5 denominators were applied across asset classes.
   */
  byDenominator: Array<{
    denominatorType:
      | "equity-plus-debt"
      | "project-cost"
      | "property-value"
      | "vehicle-value"
      | "enterprise-value"
      | "out-of-scope";
    loanCount: number;
    percentOfLoans: number;
    outstandingUsd: number;
    percentOfExposure: number;
  }>;
  /**
   * Breakdown by PCAF data quality score (1-5).
   * Weighted average score already exists in PortfolioSummary.weightedDataQuality.
   */
  byDataQualityScore: Array<{
    score: 1 | 2 | 3 | 4 | 5;
    loanCount: number;
    percentOfLoans: number;
    outstandingUsd: number;
    percentOfExposure: number;
    attributedCo2eTonnes: number;
    percentOfEmissions: number;
  }>;
  /**
   * Primary data sources used in the calculation.
   * Lists unique data sources that enabled the financed emissions calculation
   * (e.g., "Climate TRACE facility data", "EDGAR sector intensity", etc.).
   */
  dataSources: string[];
  /**
   * PCAF asset classes represented in the portfolio.
   * Per B62(a)(ii), entity shall identify which asset classes are included.
   */
  assetClasses: Array<{
    assetClass: string;
    loanCount: number;
    percentOfLoans: number;
    outstandingUsd: number;
    percentOfExposure: number;
  }>;
};

/**
 * Data extent disclosure per IFRS S2 B55–B56 and §29(a)(iii).
 *
 * Per IFRS S2 Climate-related Disclosures (June 2023) §B55, entity shall disclose
 * the **extent to which Scope 3 financed emissions are measured using** primary
 * activity data from counterparties (i.e., borrower-specific operational data).
 * Per §B56, entity shall disclose the extent using verified data (third-party assured).
 *
 * This maps directly to PCAF data quality options:
 * - **Primary-activity data** (B55): Options 2a (energy records) and 2b (production records)
 * - **Verified data** (B56): Option 1a (third-party assurance opinion)
 *
 * Added for N1.11. Each extent metric includes count, exposure (USD), and emissions (CO2e)
 * to show the portfolio coverage comprehensively.
 */
export type DataExtentDisclosure = {
  /**
   * Extent of primary-activity data (B55).
   * Emissions measured using borrower-specific operational data (PCAF Options 2a, 2b).
   */
  primaryActivityData: {
    /** Count of loans using primary-activity data */
    loanCount: number;
    /** Percentage of portfolio loans (by count) */
    percentOfLoans: number;
    /** Gross exposure (USD) covered by primary-activity data */
    grossExposureUsd: number;
    /** Percentage of total gross exposure */
    percentOfExposure: number;
    /** Attributed emissions (CO2e tonnes) from primary-activity data */
    attributedCo2eTonnes: number;
    /** Percentage of total attributed emissions */
    percentOfEmissions: number;
  };
  /**
   * Extent of verified data (B56).
   * Emissions measured using third-party verified/assured data (PCAF Option 1a).
   */
  verifiedData: {
    /** Count of loans using verified data */
    loanCount: number;
    /** Percentage of portfolio loans (by count) */
    percentOfLoans: number;
    /** Gross exposure (USD) covered by verified data */
    grossExposureUsd: number;
    /** Percentage of total gross exposure */
    percentOfExposure: number;
    /** Attributed emissions (CO2e tonnes) from verified data */
    attributedCo2eTonnes: number;
    /** Percentage of total attributed emissions */
    percentOfEmissions: number;
  };
};

export type PortfolioSummary = {
  totalLoans: number;
  totalOutstandingUsd: number;
  totalOutstandingNpr: number;
  totalAttributedCo2eTonnes: number;
  /** Weighted average data quality across in-scope loans */
  weightedDataQuality: number;
  /** Breakdown by NRB taxonomy color (count) */
  taxonomyBreakdown: TaxonomyBreakdown;
  /** Same breakdown but weighted by outstanding NPR */
  taxonomyBreakdownValue?: TaxonomyBreakdown;
  /** Breakdown by sector */
  sectorBreakdown: Array<{
    sector: string;
    attributedCo2e: number;
    loanCount: number;
    outstandingNpr?: number;
  }>;
  /** New optional fields powering the three-tier dashboard */
  funnel?: PortfolioFunnel;
  dataQualityDistribution?: DataQualityDistribution;
  trend?: PortfolioTrendPoint[];
  /**
   * IFRS S2 B62(b) gross exposure matrix — industry × asset class disaggregation
   * of funded carrying amount before loss allowance. Added for N1.1.
   */
  grossExposureMatrix?: Array<{
    industry: string;
    assetClass: string;
    grossExposureUsd: number;
    loanCount: number;
    attributedCo2eTonnes?: number;
  }>;
  /**
   * IFRS S2 B62(c) coverage — percentage of gross exposure included in
   * financed-emissions calculation, with excluded asset types named. Added for N1.2.
   * Risk mitigant exclusion disclosure added for N1.3.
   */
  grossExposureCoverage?: {
    totalGrossExposureUsd: number;
    includedGrossExposureUsd: number;
    coveragePercent: number;
    includedLoanCount: number;
    excludedLoanCount: number;
    excludedAssetTypes: string[];
    riskMitigantsExcluded: boolean;
    totalRiskMitigantValueUsd: number;
  };
  /**
   * IFRS S2 B62(d) + §29(a)(iii) methodology disclosure — structured breakdown
   * of which PCAF options, denominators, and data sources were used. Added for N1.10.
   * Replaces the hardcoded `pcafMethodologyNote` prose strings with auditor-ready
   * structured data showing the distribution of methodology approaches across the portfolio.
   */
  methodologyDisclosure?: MethodologyDisclosure;
  /**
   * IFRS S2 B55–B56 + §29(a)(iii) data extent disclosure — the extent to which
   * emissions are measured using primary-activity data (borrower-specific operational
   * data per Options 2a/2b) and verified data (third-party assured per Option 1a).
   * Added for N1.11.
   */
  dataExtentDisclosure?: DataExtentDisclosure;
  /**
   * IFRS S2 B27 consolidation approach disclosure — which approach (equity-share
   * or control) was used to measure financed emissions, and the reason for that choice.
   * When undefined, consolidation approach has not been configured for this tenant.
   * Added for N1.12.
   */
  consolidationApproach?: {
    approach: "equity-share" | "control";
    reason: string;
  };
};

// ---------------------------------------------------------------------------
// ESRM screening (Tab 1)
// ---------------------------------------------------------------------------

export type BorrowerScreening = {
  borrowerId: string;
  /** EDGAR sector emissions intensity (tCO2e per unit output) for comparison */
  sectorBenchmarkLabel?: string;
  sectorBenchmarkValue?: number;
  /** Borrower's intensity for comparison */
  borrowerIntensityValue?: number;
  /** OpenAQ reading near the facility */
  airQualityNearby?: {
    pm25: number;
    readingDate: string;
    stationName: string;
  };
  /** Ownership chain */
  ownershipTree?: Array<{
    name: string;
    entityId?: string | null;
    percentOwnership?: number | null;
  }>;
  /** Recommendation surfaced by the data layer */
  riskClassification?: "low" | "medium" | "high" | "extreme";
  recommendation?: "approve" | "approve-with-conditions" | "decline";
  reasoning?: string;
};

// ---------------------------------------------------------------------------
// Top-level dashboard data
// ---------------------------------------------------------------------------

export type BfiDemoMeta = {
  bankName: string;
  isMock: boolean;
  generatedAt: string;
  /**
   * @deprecated Use PortfolioSummary.methodologyDisclosure instead (N1.10).
   * This field is kept for backward compatibility but contains only a brief
   * summary. The structured methodologyDisclosure provides rich breakdown by
   * PCAF option, denominator type, data source, and asset class per IFRS S2
   * B62(d) + §29(a)(iii).
   */
  pcafMethodologyNote: string;
  asOfDate?: string;
  /**
   * Runtime tenant identity injected by app/page.tsx from the current
   * tenant cookie. Everything downstream reads these fields to render the
   * correct bank name, logo, and brand palette.
   */
  tenantId?: string;
  tenantLogoPath?: string;
};

export type BfiDemoData = {
  meta: BfiDemoMeta;
  borrowers: Borrower[];
  loans: Loan[];
  attributions: PcafAttribution[];
  portfolio: PortfolioSummary;
};
