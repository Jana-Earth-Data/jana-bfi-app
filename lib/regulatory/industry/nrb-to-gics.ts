/**
 * NRB sector → GICS 6-digit industry mapping for IFRS S2 B62(a)(i) compliance.
 *
 * Per *IFRS Sustainability Disclosure Standard IFRS S2 Climate-related
 * Disclosures* (June 2023), paragraph B62(a)(i):
 *
 *   "An entity **shall** use the Global Industry Classification Standard (GICS)
 *   6-digit industry-level code to identify the industry to which a
 *   counterparty belongs."
 *
 * The NFRS draft (confirmed ND.2, 2026-09-15) tracks pre-amendment IFRS S2 with
 * no GICS alternative permitted — this requirement is **mandatory** for Nepal
 * financial institutions.
 *
 * GICS STRUCTURE (6 digits total):
 *   - First 2 digits: Sector (10 sectors: 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60)
 *   - Middle 2 digits: Industry Group
 *   - Last 2 digits: Industry
 *
 * MAPPING METHODOLOGY:
 * Each NRB sector (Nepal Rastra Bank sectoral classification used in CBS/MIS
 * reporting) is mapped to the GICS 6-digit industry that best represents its
 * economic activity. Where a Nepal sector spans multiple GICS industries (e.g.,
 * "Manufacturing - Other"), the mapping chooses the most representative or uses
 * "Industrial Conglomerates" as the catch-all.
 *
 * CITATIONS:
 * - GICS structure: MSCI/S&P Global Industry Classification Standard
 * - IFRS S2 requirement: §B62(a)(i), June 2023 edition
 * - ND.2 verification: NFRS draft analysis, 2026-09-15
 *
 * LIVE USAGE:
 * In a live deployment, the bank's CBS may already classify borrowers using
 * ISIC, NACE, or another system. If so, a separate mapping from that system to
 * GICS will be needed. This module serves the demo (NRB sectors) and provides
 * the pattern for such mappings.
 */

/**
 * GICS 6-digit industry code with human-readable label.
 */
export type GicsCode = {
  /** 6-digit GICS industry code (e.g., "551010" for Electric Utilities) */
  code: string;
  /** GICS sector name (first 2 digits) */
  sector: string;
  /** GICS industry group name (middle 2 digits) */
  industryGroup: string;
  /** GICS industry name (last 2 digits) */
  industry: string;
  /** Full label for disclosure (Sector / Industry Group / Industry) */
  label: string;
};

/**
 * NRB sector → GICS 6-digit code mapping table.
 *
 * Sources:
 * - GICS codes: MSCI/S&P Global Industry Classification Standard (2023 revision)
 * - NRB sectors: Nepal Rastra Bank sectoral classification (CBS/MIS reporting)
 *
 * Each entry maps a Nepal bank's sector classification to the GICS industry
 * that most accurately represents the borrower's economic activity.
 */
export const NRB_TO_GICS_MAP: Record<string, GicsCode> = {
  // ENERGY
  "Energy - Hydropower": {
    code: "551010",
    sector: "Utilities",
    industryGroup: "Utilities",
    industry: "Electric Utilities",
    label: "Utilities / Utilities / Electric Utilities",
  },

  // MATERIALS - Construction Materials
  "Manufacturing - Cement": {
    code: "151020",
    sector: "Materials",
    industryGroup: "Materials",
    industry: "Construction Materials",
    label: "Materials / Materials / Construction Materials",
  },
  "Manufacturing - Brick": {
    code: "151020",
    sector: "Materials",
    industryGroup: "Materials",
    industry: "Construction Materials",
    label: "Materials / Materials / Construction Materials",
  },

  // MATERIALS - Metals & Mining
  "Manufacturing - Steel": {
    code: "151040",
    sector: "Materials",
    industryGroup: "Materials",
    industry: "Steel",
    label: "Materials / Materials / Steel",
  },

  // MATERIALS - Chemicals
  "Manufacturing - Chemicals": {
    code: "151010",
    sector: "Materials",
    industryGroup: "Materials",
    industry: "Commodity Chemicals",
    label: "Materials / Materials / Commodity Chemicals",
  },

  // MATERIALS - Containers & Packaging
  "Manufacturing - Plastics": {
    code: "151050",
    sector: "Materials",
    industryGroup: "Materials",
    industry: "Containers & Packaging",
    label: "Materials / Materials / Containers & Packaging",
  },

  // CONSUMER DISCRETIONARY - Textiles
  "Manufacturing - Textiles": {
    code: "252010",
    sector: "Consumer Discretionary",
    industryGroup: "Consumer Durables & Apparel",
    industry: "Textiles, Apparel & Luxury Goods",
    label: "Consumer Discretionary / Consumer Durables & Apparel / Textiles, Apparel & Luxury Goods",
  },

  // CONSUMER STAPLES - Food Products
  "Manufacturing - FMCG": {
    code: "302020",
    sector: "Consumer Staples",
    industryGroup: "Food, Beverage & Tobacco",
    industry: "Food Products",
    label: "Consumer Staples / Food, Beverage & Tobacco / Food Products",
  },
  "Agriculture - Processing": {
    code: "302020",
    sector: "Consumer Staples",
    industryGroup: "Food, Beverage & Tobacco",
    industry: "Food Products",
    label: "Consumer Staples / Food, Beverage & Tobacco / Food Products",
  },

  // INDUSTRIALS - Catch-all for diversified manufacturing
  "Manufacturing - Other": {
    code: "201060",
    sector: "Industrials",
    industryGroup: "Capital Goods",
    industry: "Industrial Conglomerates",
    label: "Industrials / Capital Goods / Industrial Conglomerates",
  },

  // CONSUMER DISCRETIONARY - Hotels & Tourism
  "Hospitality - Tourism": {
    code: "253010",
    sector: "Consumer Discretionary",
    industryGroup: "Consumer Services",
    industry: "Hotels, Restaurants & Leisure",
    label: "Consumer Discretionary / Consumer Services / Hotels, Restaurants & Leisure",
  },

  // REAL ESTATE
  "Real Estate - Commercial": {
    code: "601010",
    sector: "Real Estate",
    industryGroup: "Real Estate",
    industry: "Equity Real Estate Investment Trusts (REITs)",
    label: "Real Estate / Real Estate / Equity Real Estate Investment Trusts (REITs)",
  },

  // INDUSTRIALS - Transportation
  "Transport & Storage": {
    code: "203020",
    sector: "Industrials",
    industryGroup: "Transportation",
    industry: "Air Freight & Logistics",
    label: "Industrials / Transportation / Air Freight & Logistics",
  },

  // CONSUMER DISCRETIONARY - Retail (for retail-pool borrowers if needed)
  Retail: {
    code: "255040",
    sector: "Consumer Discretionary",
    industryGroup: "Retailing",
    industry: "Specialty Retail",
    label: "Consumer Discretionary / Retailing / Specialty Retail",
  },

  // UTILITIES - Waste Management
  "Utilities - Waste Management": {
    code: "552020",
    sector: "Utilities",
    industryGroup: "Utilities",
    industry: "Multi-Utilities",
    label: "Utilities / Utilities / Multi-Utilities",
  },
};

/**
 * IFRS S2 B62(a)(i) citation surfaced in tooltips / auditor exports.
 */
export const IFRS_S2_B62_A_I_CITATION =
  "IFRS S2 Climate-related Disclosures (June 2023) §B62(a)(i) — GICS 6-digit industry classification";

/**
 * Look up GICS 6-digit code for a given NRB sector.
 *
 * @param nrbSector - NRB sector classification string (e.g., "Manufacturing - Cement")
 * @returns GICS code object if mapping exists, undefined otherwise
 *
 * Example:
 * ```ts
 * const gics = gicsCodeForNrbSector("Manufacturing - Cement");
 * // { code: "151020", sector: "Materials", ..., label: "Materials / Materials / Construction Materials" }
 * ```
 */
export function gicsCodeForNrbSector(nrbSector: string): GicsCode | undefined {
  return NRB_TO_GICS_MAP[nrbSector];
}

/**
 * Get the 6-digit GICS code string for an NRB sector.
 *
 * @param nrbSector - NRB sector classification string
 * @returns 6-digit GICS code (e.g., "151020"), or undefined if no mapping exists
 *
 * Example:
 * ```ts
 * const code = gicsCodeString("Energy - Hydropower");
 * // "551010"
 * ```
 */
export function gicsCodeString(nrbSector: string): string | undefined {
  return NRB_TO_GICS_MAP[nrbSector]?.code;
}

/**
 * Get the full GICS label for an NRB sector.
 *
 * @param nrbSector - NRB sector classification string
 * @returns Full GICS label (e.g., "Materials / Materials / Construction Materials"),
 *          or undefined if no mapping exists
 *
 * Example:
 * ```ts
 * const label = gicsLabel("Manufacturing - Cement");
 * // "Materials / Materials / Construction Materials"
 * ```
 */
export function gicsLabel(nrbSector: string): string | undefined {
  return NRB_TO_GICS_MAP[nrbSector]?.label;
}

/**
 * Check if an NRB sector has a GICS mapping.
 *
 * @param nrbSector - NRB sector classification string
 * @returns true if mapping exists, false otherwise
 */
export function hasGicsMapping(nrbSector: string): boolean {
  return nrbSector in NRB_TO_GICS_MAP;
}

/**
 * Get all NRB sectors that have GICS mappings.
 *
 * @returns Array of NRB sector strings with GICS mappings
 */
export function mappedNrbSectors(): string[] {
  return Object.keys(NRB_TO_GICS_MAP);
}
