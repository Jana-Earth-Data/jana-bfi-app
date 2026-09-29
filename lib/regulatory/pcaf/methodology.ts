/**
 * PCAF methodology disclosure computation per IFRS S2 B62(d) and §29(a)(iii).
 *
 * Per IFRS S2 Climate-related Disclosures (June 2023) §B62(d), entity shall disclose
 * the **methodology** used to measure financed emissions, including the allocation method.
 * Per §29(a)(iii), entity shall disclose the measurement approach, inputs, assumptions,
 * and estimation techniques used.
 *
 * This module computes structured methodology disclosure from PCAF attributions,
 * replacing the hardcoded `pcafMethodologyNote` prose strings (N1.10) with
 * auditor-ready breakdowns showing:
 * - Which PCAF options (1a/1b/2a/2b/3a/3b/3c) were used across the portfolio
 * - Which attribution denominators (equity+debt, project cost, etc.) were applied
 * - Distribution of data quality scores
 * - Data sources used
 * - Asset classes represented
 *
 * All breakdowns include both count-based and weighted percentages (by exposure
 * and emissions) per B62(d) requirement to disclose the allocation method.
 */

import type { Loan, PcafAttribution, MethodologyDisclosure } from "@/lib/types/bfi";
import type { PcafOption } from "./types";
import type { DenominatorType } from "./attribution";

/**
 * Compute IFRS S2 B62(d) + §29(a)(iii) methodology disclosure from attributions.
 *
 * Per IFRS S2, entity shall disclose the methodology used to measure financed emissions.
 * This function aggregates per-loan methodology metadata (PCAF option, denominator type,
 * data quality score, data source, asset class) into portfolio-level disclosure showing:
 *
 * 1. **By PCAF option** — distribution of options 1a/1b/2a/2b/3a/3b/3c with count,
 *    % of loans, outstanding USD, % of exposure, attributed CO2e, % of emissions
 * 2. **By denominator type** — distribution of equity+debt / project-cost /
 *    property-value / vehicle-value / enterprise-value denominators (N1.9)
 * 3. **By data quality score** — distribution of scores 1-5 (same structure as byOption)
 * 4. **Data sources** — unique list of data sources used (e.g., "Climate TRACE", "EDGAR")
 * 5. **Asset classes** — which PCAF §5 asset classes are represented in the portfolio
 *
 * **Handling undefined metadata:** When attribution fields are undefined (e.g., old
 * attributions pre-N1.8/N1.9), they are excluded from the respective breakdowns.
 * This ensures backward compatibility while providing rich disclosure for new data.
 *
 * @param attributions - All PCAF attributions (in-scope and out-of-scope)
 * @param loans - All loans (needed for outstanding USD)
 * @returns Structured methodology disclosure per IFRS S2 B62(d) + §29(a)(iii)
 */
export function computeMethodologyDisclosure(
  attributions: PcafAttribution[],
  loans: Loan[],
): MethodologyDisclosure {
  // Build loan lookup for outstanding USD
  const loanById = new Map(loans.map((l) => [l.id, l]));

  // Total metrics for percentage calculations
  const totalLoans = attributions.length;
  const totalOutstandingUsd = attributions.reduce(
    (sum, a) => sum + (loanById.get(a.loanId)?.outstandingUsd ?? 0),
    0,
  );
  const totalAttributedCo2eTonnes = attributions.reduce(
    (sum, a) => sum + a.attributedCo2eTonnes,
    0,
  );

  // -------------------------------------------------------------------------
  // 1. By PCAF option (1a/1b/2a/2b/3a/3b/3c)
  // -------------------------------------------------------------------------
  const byOptionMap = new Map<
    PcafOption,
    {
      loanCount: number;
      outstandingUsd: number;
      attributedCo2eTonnes: number;
    }
  >();

  for (const attr of attributions) {
    if (!attr.pcafOption) continue; // Skip attributions without option (backward compat)

    const existing = byOptionMap.get(attr.pcafOption) ?? {
      loanCount: 0,
      outstandingUsd: 0,
      attributedCo2eTonnes: 0,
    };

    byOptionMap.set(attr.pcafOption, {
      loanCount: existing.loanCount + 1,
      outstandingUsd:
        existing.outstandingUsd + (loanById.get(attr.loanId)?.outstandingUsd ?? 0),
      attributedCo2eTonnes: existing.attributedCo2eTonnes + attr.attributedCo2eTonnes,
    });
  }

  const byOption = Array.from(byOptionMap.entries()).map(([option, data]) => ({
    option,
    loanCount: data.loanCount,
    percentOfLoans: (data.loanCount / totalLoans) * 100,
    outstandingUsd: data.outstandingUsd,
    percentOfExposure:
      totalOutstandingUsd > 0 ? (data.outstandingUsd / totalOutstandingUsd) * 100 : 0,
    attributedCo2eTonnes: data.attributedCo2eTonnes,
    percentOfEmissions:
      totalAttributedCo2eTonnes > 0
        ? (data.attributedCo2eTonnes / totalAttributedCo2eTonnes) * 100
        : 0,
  }));

  // Sort by option for consistent display (1a, 1b, 2a, 2b, 3a, 3b, 3c)
  byOption.sort((a, b) => {
    const order: Record<PcafOption, number> = {
      "1a": 1,
      "1b": 2,
      "2a": 3,
      "2b": 4,
      "3a": 5,
      "3b": 6,
      "3c": 7,
    };
    return order[a.option] - order[b.option];
  });

  // -------------------------------------------------------------------------
  // 2. By denominator type (N1.9)
  // -------------------------------------------------------------------------
  const byDenominatorMap = new Map<
    DenominatorType,
    {
      loanCount: number;
      outstandingUsd: number;
    }
  >();

  for (const attr of attributions) {
    if (!attr.denominatorType) continue; // Skip attributions without denominator type

    const existing = byDenominatorMap.get(attr.denominatorType) ?? {
      loanCount: 0,
      outstandingUsd: 0,
    };

    byDenominatorMap.set(attr.denominatorType, {
      loanCount: existing.loanCount + 1,
      outstandingUsd:
        existing.outstandingUsd + (loanById.get(attr.loanId)?.outstandingUsd ?? 0),
    });
  }

  const byDenominator = Array.from(byDenominatorMap.entries()).map(
    ([denominatorType, data]) => ({
      denominatorType,
      loanCount: data.loanCount,
      percentOfLoans: (data.loanCount / totalLoans) * 100,
      outstandingUsd: data.outstandingUsd,
      percentOfExposure:
        totalOutstandingUsd > 0 ? (data.outstandingUsd / totalOutstandingUsd) * 100 : 0,
    }),
  );

  // Sort by denominator type for consistent display
  const denominatorOrder: Record<DenominatorType, number> = {
    "equity-plus-debt": 1,
    "project-cost": 2,
    "property-value": 3,
    "vehicle-value": 4,
    "enterprise-value": 5,
    "out-of-scope": 6,
  };
  byDenominator.sort(
    (a, b) => denominatorOrder[a.denominatorType] - denominatorOrder[b.denominatorType],
  );

  // -------------------------------------------------------------------------
  // 3. By data quality score (1-5)
  // -------------------------------------------------------------------------
  const byScoreMap = new Map<
    1 | 2 | 3 | 4 | 5,
    {
      loanCount: number;
      outstandingUsd: number;
      attributedCo2eTonnes: number;
    }
  >();

  for (const attr of attributions) {
    const score = attr.dataQualityScore;
    const existing = byScoreMap.get(score) ?? {
      loanCount: 0,
      outstandingUsd: 0,
      attributedCo2eTonnes: 0,
    };

    byScoreMap.set(score, {
      loanCount: existing.loanCount + 1,
      outstandingUsd:
        existing.outstandingUsd + (loanById.get(attr.loanId)?.outstandingUsd ?? 0),
      attributedCo2eTonnes: existing.attributedCo2eTonnes + attr.attributedCo2eTonnes,
    });
  }

  const byDataQualityScore = Array.from(byScoreMap.entries()).map(([score, data]) => ({
    score,
    loanCount: data.loanCount,
    percentOfLoans: (data.loanCount / totalLoans) * 100,
    outstandingUsd: data.outstandingUsd,
    percentOfExposure:
      totalOutstandingUsd > 0 ? (data.outstandingUsd / totalOutstandingUsd) * 100 : 0,
    attributedCo2eTonnes: data.attributedCo2eTonnes,
    percentOfEmissions:
      totalAttributedCo2eTonnes > 0
        ? (data.attributedCo2eTonnes / totalAttributedCo2eTonnes) * 100
        : 0,
  }));

  // Sort by score (1, 2, 3, 4, 5)
  byDataQualityScore.sort((a, b) => a.score - b.score);

  // -------------------------------------------------------------------------
  // 4. Data sources (unique list)
  // -------------------------------------------------------------------------
  const dataSourcesSet = new Set<string>();
  for (const attr of attributions) {
    if (attr.pcafDataSource) {
      dataSourcesSet.add(attr.pcafDataSource);
    }
  }
  const dataSources = Array.from(dataSourcesSet).sort();

  // -------------------------------------------------------------------------
  // 5. Asset classes (unique with counts + exposure)
  // -------------------------------------------------------------------------
  const assetClassMap = new Map<
    string,
    {
      loanCount: number;
      outstandingUsd: number;
    }
  >();

  for (const attr of attributions) {
    if (!attr.pcafAssetClass) continue; // Skip attributions without asset class

    const existing = assetClassMap.get(attr.pcafAssetClass) ?? {
      loanCount: 0,
      outstandingUsd: 0,
    };

    assetClassMap.set(attr.pcafAssetClass, {
      loanCount: existing.loanCount + 1,
      outstandingUsd:
        existing.outstandingUsd + (loanById.get(attr.loanId)?.outstandingUsd ?? 0),
    });
  }

  const assetClasses = Array.from(assetClassMap.entries()).map(([assetClass, data]) => ({
    assetClass,
    loanCount: data.loanCount,
    percentOfLoans: (data.loanCount / totalLoans) * 100,
    outstandingUsd: data.outstandingUsd,
    percentOfExposure:
      totalOutstandingUsd > 0 ? (data.outstandingUsd / totalOutstandingUsd) * 100 : 0,
  }));

  // Sort by asset class name for consistent display
  assetClasses.sort((a, b) => a.assetClass.localeCompare(b.assetClass));

  return {
    byOption,
    byDenominator,
    byDataQualityScore,
    dataSources,
    assetClasses,
  };
}
