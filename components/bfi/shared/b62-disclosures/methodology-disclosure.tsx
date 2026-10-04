/**
 * IFRS S2 B62(d) — Methodology Disclosure
 *
 * Displays the methodology used to measure financed emissions, as required by
 * IFRS S2 paragraph B62(d) and §29(a)(iii).
 *
 * Per IFRS S2 B62(d):
 *   "An entity shall disclose... the methodology it has used to measure its
 *   financed emissions, including the approach to attribution."
 *
 * Per IFRS S2 §29(a)(iii):
 *   "An entity shall disclose... the measurement approach, inputs, and
 *   estimation techniques used... and the reasons for those choices."
 *
 * This component replaces the deprecated hardcoded `pcafMethodologyNote` string
 * with structured, auditor-ready breakdowns showing:
 * - PCAF option distribution (1a/1b/2a/2b/3a/3b/3c)
 * - Attribution denominator types applied
 * - Data quality score distribution
 * - Data sources used
 * - Asset classes represented
 */
"use client";

import React from "react";
import { formatUsd, formatCo2e, formatPercent, formatNumber } from "../../ui";
import { Badge, StatRow } from "../primitives";

export type MethodologyDisclosure = {
  byOption: Array<{
    option: "1a" | "1b" | "2a" | "2b" | "3a" | "3b" | "3c";
    loanCount: number;
    percentOfLoans: number;
    outstandingUsd: number;
    percentOfExposure: number;
    attributedCo2eTonnes: number;
    percentOfEmissions: number;
  }>;
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
  byDataQualityScore: Array<{
    score: 1 | 2 | 3 | 4 | 5;
    loanCount: number;
    percentOfLoans: number;
    outstandingUsd: number;
    percentOfExposure: number;
    attributedCo2eTonnes: number;
    percentOfEmissions: number;
  }>;
  dataSources: string[];
  assetClasses: Array<{
    assetClass: string;
    loanCount: number;
    percentOfLoans: number;
    outstandingUsd: number;
    percentOfExposure: number;
  }>;
};

const PCAF_OPTION_LABELS: Record<string, string> = {
  "1a": "Option 1a — Verified emissions (third-party assured)",
  "1b": "Option 1b — Audited emissions (financial audit)",
  "2a": "Option 2a — Primary activity data (energy records)",
  "2b": "Option 2b — Primary activity data (production records)",
  "3a": "Option 3a — Derived proxy (average data)",
  "3b": "Option 3b — Derived proxy (sector intensity)",
  "3c": "Option 3c — Derived proxy (asset type average)",
};

const DENOMINATOR_LABELS: Record<string, string> = {
  "equity-plus-debt": "Equity + Debt (PCAF §5.1)",
  "project-cost": "Total Project Cost (PCAF §5.3)",
  "property-value": "Property Value (PCAF §5.4)",
  "vehicle-value": "Vehicle Value (PCAF §5.7)",
  "enterprise-value": "Enterprise Value (fallback)",
  "out-of-scope": "Out of Scope",
};

export function MethodologyDisclosure({
  data,
}: {
  data: MethodologyDisclosure | undefined;
}) {
  if (!data) {
    return (
      <div className="rounded-lg border border-line bg-panel p-4 text-center text-sm text-slate-400">
        No methodology disclosure data available.
      </div>
    );
  }

  const { byOption, byDenominator, byDataQualityScore, dataSources, assetClasses } = data;

  return (
    <div className="space-y-6">
      {/* PCAF Option Distribution */}
      {byOption.length > 0 && (
        <div className="rounded-lg border border-line bg-panel p-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-300">
            PCAF Data Quality Options (B62(d))
          </h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-line/50">
                  <th className="px-2 py-2 text-left font-medium text-slate-400">Option</th>
                  <th className="px-2 py-2 text-right font-medium text-slate-400">Loans</th>
                  <th className="px-2 py-2 text-right font-medium text-slate-400">% Loans</th>
                  <th className="px-2 py-2 text-right font-medium text-slate-400">Exposure</th>
                  <th className="px-2 py-2 text-right font-medium text-slate-400">% Exposure</th>
                  <th className="px-2 py-2 text-right font-medium text-slate-400">Emissions</th>
                  <th className="px-2 py-2 text-right font-medium text-slate-400">% Emissions</th>
                </tr>
              </thead>
              <tbody>
                {byOption.map((row) => (
                  <tr key={row.option} className="border-b border-line/30 last:border-b-0">
                    <td className="px-2 py-2 text-slate-200" title={PCAF_OPTION_LABELS[row.option]}>
                      {row.option}
                    </td>
                    <td className="px-2 py-2 text-right text-white">{formatNumber(row.loanCount)}</td>
                    <td className="px-2 py-2 text-right text-slate-300">{formatPercent(row.percentOfLoans / 100)}</td>
                    <td className="px-2 py-2 text-right text-white">{formatUsd(row.outstandingUsd)}</td>
                    <td className="px-2 py-2 text-right text-slate-300">{formatPercent(row.percentOfExposure / 100)}</td>
                    <td className="px-2 py-2 text-right text-white">{formatCo2e(row.attributedCo2eTonnes)}</td>
                    <td className="px-2 py-2 text-right text-slate-300">{formatPercent(row.percentOfEmissions / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Options 1a/1b are highest quality (reported/verified data); 2a/2b use primary activity data;
            3a/3b/3c are proxies (average, sector, or asset-type intensities). PCAF Global GHG Accounting
            and Reporting Standard Part A 3rd Edition §5.2-§5.3.
          </p>
        </div>
      )}

      {/* Attribution Denominator Distribution */}
      {byDenominator.length > 0 && (
        <div className="rounded-lg border border-line bg-panel p-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-300">
            Attribution Denominators (§29(a)(iii))
          </h4>
          <div className="space-y-0">
            {byDenominator.map((row) => (
              <StatRow
                key={row.denominatorType}
                label={DENOMINATOR_LABELS[row.denominatorType] || row.denominatorType}
                value={
                  <div className="space-y-0.5 text-right">
                    <div className="text-sm font-medium text-white">
                      {formatNumber(row.loanCount)} loans ({formatPercent(row.percentOfLoans / 100)})
                    </div>
                    <div className="text-xs text-slate-400">
                      {formatUsd(row.outstandingUsd)} ({formatPercent(row.percentOfExposure / 100)})
                    </div>
                  </div>
                }
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Allocation denominators per PCAF §5. Equity+debt (§5.1) is preferred; enterprise value
            is a fallback when balance sheet data is unavailable.
          </p>
        </div>
      )}

      {/* Data Quality Score Distribution */}
      {byDataQualityScore.length > 0 && (
        <div className="rounded-lg border border-line bg-panel p-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-300">
            Data Quality Score Distribution (PCAF §5.2)
          </h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-line/50">
                  <th className="px-2 py-2 text-left font-medium text-slate-400">Score</th>
                  <th className="px-2 py-2 text-right font-medium text-slate-400">Loans</th>
                  <th className="px-2 py-2 text-right font-medium text-slate-400">Exposure</th>
                  <th className="px-2 py-2 text-right font-medium text-slate-400">Emissions</th>
                </tr>
              </thead>
              <tbody>
                {byDataQualityScore.map((row) => (
                  <tr key={row.score} className="border-b border-line/30 last:border-b-0">
                    <td className="px-2 py-2 text-slate-200">
                      Score {row.score}
                      <span className="ml-2 text-xs text-slate-500">
                        ({formatPercent(row.percentOfLoans / 100)} of loans)
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right text-white">{formatNumber(row.loanCount)}</td>
                    <td className="px-2 py-2 text-right text-white">{formatUsd(row.outstandingUsd)}</td>
                    <td className="px-2 py-2 text-right text-white">{formatCo2e(row.attributedCo2eTonnes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Score 1 = highest quality (verified emissions); Score 5 = lowest quality (proxies/assumptions).
            Weighted average displayed in KPIs above.
          </p>
        </div>
      )}

      {/* Data Sources */}
      {dataSources.length > 0 && (
        <div className="rounded-lg border border-line bg-panel p-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-300">
            Primary Data Sources (§29(a)(iii))
          </h4>
          <div className="flex flex-wrap gap-2">
            {dataSources.map((source, idx) => (
              <Badge key={idx} className="bg-slate-700/50 text-slate-300 border-slate-600">
                {source}
              </Badge>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Emission factors and facility-level data sources used in financed emissions calculation.
            Per IFRS S2 §29(a)(iii), entity shall disclose the inputs used.
          </p>
        </div>
      )}

      {/* Asset Classes */}
      {assetClasses.length > 0 && (
        <div className="rounded-lg border border-line bg-panel p-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-300">
            Asset Classes Represented (B62(a)(ii))
          </h4>
          <div className="space-y-0">
            {assetClasses.map((row) => (
              <StatRow
                key={row.assetClass}
                label={row.assetClass}
                value={
                  <div className="space-y-0.5 text-right">
                    <div className="text-sm font-medium text-white">
                      {formatNumber(row.loanCount)} loans ({formatPercent(row.percentOfLoans / 100)})
                    </div>
                    <div className="text-xs text-slate-400">
                      {formatUsd(row.outstandingUsd)} ({formatPercent(row.percentOfExposure / 100)})
                    </div>
                  </div>
                }
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            PCAF asset classes per Part A 3rd Edition §5. Business Loans (§5.2), Project Finance (§5.3),
            Commercial Real Estate (§5.4), Motor Vehicle Loans (§5.7).
          </p>
        </div>
      )}
    </div>
  );
}
