/**
 * Tenant model for the BFI demo.
 *
 * A "tenant" is the bank whose UI, branding, and captured officer data the
 * demo is currently rendering for. The tenant is picked at deploy time via
 * NEXT_PUBLIC_TENANT (see lib/tenants/index.ts).
 *
 * Everything a page needs to render bank-specific chrome, branch codes,
 * loan captions, and per-tenant persistence keys lives on this shape.
 */

import type { FxRate } from "@/lib/regulatory/fx/rates";

export type TenantId = "default" | "laxmi_sunrise";

/**
 * NRB BFI licence class — the column axis of the Annex 4b Green Finance
 * Statement. A = commercial bank, B = development bank, C = finance company,
 * D (microfinance) and other institutions roll into "other". A per-BFI
 * submission fills exactly ONE class column based on the institution's own
 * licence, so this is a property of the *tenant*, not of the report code.
 *
 * Defined here (not in lib/reports) so the tenant model owns it and the report
 * layer reads it — the dependency runs reports → tenants, never the reverse.
 */
export type BankClass = "A" | "B" | "C" | "other";

/**
 * Consolidation approach per IFRS S2 B27.
 *
 * Per IFRS S2 Climate-related Disclosures (June 2023) §B27, entity shall use
 * either the **equity share approach** or the **control approach** when measuring
 * financed emissions, and shall disclose which approach was used and the reason.
 *
 * - **equity-share**: Emissions attributed proportionally to the entity's ownership stake.
 *   Most common for banks with minority stakes in borrowers (typical loan portfolio).
 * - **control**: Emissions attributed based on operational or financial control.
 *   Used when the entity controls the borrower (rare in commercial lending).
 *
 * This is a bank-wide accounting policy decision, not a per-loan choice.
 */
export type ConsolidationApproach = "equity-share" | "control";

/**
 * Consolidation approach configuration per IFRS S2 B27.
 * Disclosed in PortfolioSummary to satisfy the B27 requirement.
 */
export type ConsolidationConfig = {
  /** Approach used (equity-share or control) */
  approach: ConsolidationApproach;
  /**
   * Reason for choosing this approach.
   * Per B27, the entity shall disclose the reason for the choice.
   * Example: "Equity share approach used because the bank does not exercise
   * operational control over borrowers in its commercial loan portfolio."
   */
  reason: string;
};

/**
 * Reporting period configuration per IFRS S1 §24 and IFRS S2 §29(a)(iii).
 * Per S1 §24, sustainability-related disclosures shall be for the same
 * reporting period as the related financial statements and shall provide
 * comparatives. The reporting period defines which years the trend covers,
 * which year is the "most recent fully-reported" year, and the as-of date
 * the disclosure is prepared to.
 *
 * When undefined on a tenant, the platform falls back to the pinned constants
 * in lib/regulatory/reporting/period.ts. A live bank derives this from its
 * ingested Climate TRACE coverage; a demo tenant leaves it undefined.
 */
export type ReportingPeriod = {
  /** Years the platform builds emissions trends for (e.g., [2021, 2022, 2023, 2024, 2025]) */
  readonly trendYears: readonly number[];
  /** Most recent fully-reported year cited in annual disclosure (e.g., 2024) */
  readonly latestFullYear: number;
  /** Latest year with any data; may be partial (e.g., 2025) */
  readonly latestYear: number;
  /** How far into latestYear the data runs (e.g., "October"); undefined if latestYear is complete */
  readonly latestYearPartialThrough?: string;
  /** The as-of date the disclosure is prepared to (ISO YYYY-MM-DD) */
  readonly asOfDate: string;
};

/** Officer roles surfaced in the officer-picker (Phase 2 UI). */
export type OfficerRole =
  | "loan_officer"
  | "esg_officer"
  | "compliance"
  | "credit_committee";

export type Officer = {
  id: string;
  name: string;
  role: OfficerRole;
  email?: string;
};

export type TenantBranding = {
  /** Full display name used in headers, footers, and email templates. */
  displayName: string;
  /** Short form used where space is tight (KPI sublabels, badges). */
  shortName: string;
  /**
   * Path (from /public) to the tenant's primary logo. Should be a square
   * PNG or SVG. When absent, the app falls back to the Jana green_logo.png.
   */
  logoPath: string;
  /**
   * Optional wordmark (horizontal). Used in the app header. When absent,
   * the app renders the shortName in text.
   */
  wordmarkPath?: string;
  /** CSS-friendly hex, used for primary buttons, active nav, etc. */
  primaryColorHex: string;
  /** CSS-friendly hex, used for accent chips, KPI values, etc. */
  accentColorHex: string;
};

export type TenantConfig = {
  /** Stable identifier. Persisted on every captured row. */
  id: TenantId;
  branding: TenantBranding;
  /**
   * NRB BFI licence class for this institution. Determines which Annex 4b
   * column the Green Finance Statement fills. Both demo tenants are Class A
   * commercial banks; a Class B/C tenant added later sets this accordingly.
   */
  bankClass: BankClass;
  /**
   * Two-to-four-letter prefix used on branch codes for this bank (e.g.
   * "FBN-001", "LSB-001"). The synthesizer uses this when generating the
   * default portfolio for a new tenant.
   */
  branchCodePrefix: string;
  /**
   * Access codes handed to the bank for this tenant. Rotatable — adding
   * a new code and removing an old one does not touch any captured data,
   * because bank_id on Supabase rows is the tenant.id (stable), not the
   * code. Case-insensitive on lookup.
   *
   * Empty array means "no code required" — used for the default tenant,
   * which anyone can land on without a code by clicking the "Continue as
   * <default bank>" button on the landing page.
   */
  accessCodes: string[];
  /**
   * Officers surfaced in the picker. Not authoritative — the source of
   * truth for real deployments would be the bfi_officers Supabase table.
   * This list is what the demo shows on first open.
   */
  demoOfficers: Officer[];
  /**
   * If true, this tenant is the fallback when no cookie is set and no
   * valid access code is presented. Exactly one tenant must set this true.
   */
  isDefault: boolean;
  /**
   * IFRS S2 B27 consolidation approach configuration.
   * When undefined, consolidation approach has not been configured for this tenant
   * (honest disclosure - no fabricated default). Once set, disclosed in PortfolioSummary.
   * Added for N1.12.
   */
  consolidationApproach?: ConsolidationConfig;
  /**
   * Per-tenant reporting FX rate per IFRS S1 §24.
   * When undefined, falls back to REPORTING_FX_RATE constant in lib/regulatory/fx/rates.ts
   * (133.5 NPR/USD as-of 2024-07-15). A live bank sets this to the rate used to translate
   * USD-denominated exposures in its own financial statements. Demo tenants leave undefined
   * (arithmetic neutrality - goldens frozen). Added for N1.13.
   */
  reportingFxRate?: FxRate;
  /**
   * Per-tenant reporting period per IFRS S1 §24 and IFRS S2 §29(a)(iii).
   * When undefined, falls back to period constants in lib/regulatory/reporting/period.ts
   * (2021-2025 trend, 2024 latest full year, as-of 2025-10-31). A live bank derives this
   * from its ingested Climate TRACE coverage. Demo tenants leave undefined (arithmetic
   * neutrality - goldens frozen). Added for N1.13.
   */
  reportingPeriod?: ReportingPeriod;
};
