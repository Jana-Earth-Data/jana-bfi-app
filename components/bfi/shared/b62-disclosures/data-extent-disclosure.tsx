/**
 * IFRS S2 B55-B56 — Data Extent Disclosure
 *
 * Displays the extent to which financed emissions are measured using
 * primary-activity data and verified data, as required by IFRS S2
 * paragraphs B55 and B56.
 *
 * Per IFRS S2 B55:
 *   "An entity shall disclose... the extent to which Scope 3 financed emissions
 *   are measured using data obtained from counterparties (for example,
 *   primary data based on counterparties' reported emissions or measured
 *   activity)."
 *
 * Per IFRS S2 B56:
 *   "An entity shall disclose... the extent to which emissions reported by
 *   counterparties have been verified (for example, by a third-party
 *   assurance provider)."
 *
 * This component shows:
 * - % of emissions measured using primary-activity data (PCAF options 2a/2b)
 * - % of emissions measured using verified data (PCAF option 1a)
 * - Breakdown by loans, exposure, and emissions for each category
 */
"use client";

import React from "react";
import { formatUsd, formatCo2e, formatPercent, formatNumber } from "../../ui";
import { KpiCard, StatRow } from "../primitives";

export type DataExtentDisclosure = {
  primaryActivityData: {
    loanCount: number;
    percentOfLoans: number;
    grossExposureUsd: number;
    percentOfExposure: number;
    attributedCo2eTonnes: number;
    percentOfEmissions: number;
  };
  verifiedData: {
    loanCount: number;
    percentOfLoans: number;
    grossExposureUsd: number;
    percentOfExposure: number;
    attributedCo2eTonnes: number;
    percentOfEmissions: number;
  };
};

export function DataExtentDisclosure({
  data,
}: {
  data: DataExtentDisclosure | undefined;
}) {
  if (!data) {
    return (
      <div className="rounded-lg border border-line bg-panel p-4 text-center text-sm text-slate-400">
        No data extent disclosure available.
      </div>
    );
  }

  const { primaryActivityData, verifiedData } = data;

  return (
    <div className="space-y-6">
      {/* Primary Activity Data (B55) */}
      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-300">
          Primary-Activity Data (B55)
        </h4>
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard
            label="% of Emissions"
            value={formatPercent(primaryActivityData.percentOfEmissions / 100)}
            sublabel="Measured using borrower operational data"
            accent
          />
          <KpiCard
            label="% of Exposure"
            value={formatPercent(primaryActivityData.percentOfExposure / 100)}
            sublabel={formatUsd(primaryActivityData.grossExposureUsd)}
          />
          <KpiCard
            label="Loan Count"
            value={formatNumber(primaryActivityData.loanCount)}
            sublabel={`${formatPercent(primaryActivityData.percentOfLoans / 100)} of portfolio`}
          />
        </div>
        <div className="mt-3 rounded-lg border border-line bg-panel p-4">
          <p className="text-xs text-slate-400">
            Primary-activity data (PCAF Options 2a/2b) includes borrower-specific energy
            consumption records or production data. This is the highest quality data for
            calculating financed emissions, as it reflects actual operational activity rather
            than industry averages or proxies.
          </p>
        </div>
      </div>

      {/* Verified Data (B56) */}
      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-300">
          Verified Data (B56)
        </h4>
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard
            label="% of Emissions"
            value={formatPercent(verifiedData.percentOfEmissions / 100)}
            sublabel="Third-party verified/assured"
            accent
          />
          <KpiCard
            label="% of Exposure"
            value={formatPercent(verifiedData.percentOfExposure / 100)}
            sublabel={formatUsd(verifiedData.grossExposureUsd)}
          />
          <KpiCard
            label="Loan Count"
            value={formatNumber(verifiedData.loanCount)}
            sublabel={`${formatPercent(verifiedData.percentOfLoans / 100)} of portfolio`}
          />
        </div>
        <div className="mt-3 rounded-lg border border-line bg-panel p-4">
          <p className="text-xs text-slate-400">
            Verified data (PCAF Option 1a) includes emissions that have been verified by a
            third-party assurance provider. This is the highest quality disclosure per
            IFRS S2 B56, demonstrating rigorous external validation of reported emissions.
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-line bg-panel p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-300">
          Data Quality Summary
        </h4>
        <div className="space-y-0">
          <StatRow
            label="Primary-activity data coverage"
            value={
              <div className="text-right">
                <div className="text-sm font-medium text-white">
                  {formatCo2e(primaryActivityData.attributedCo2eTonnes)}
                </div>
                <div className="text-xs text-slate-400">
                  {formatPercent(primaryActivityData.percentOfEmissions / 100)} of total emissions
                </div>
              </div>
            }
          />
          <StatRow
            label="Verified data coverage"
            value={
              <div className="text-right">
                <div className="text-sm font-medium text-white">
                  {formatCo2e(verifiedData.attributedCo2eTonnes)}
                </div>
                <div className="text-xs text-slate-400">
                  {formatPercent(verifiedData.percentOfEmissions / 100)} of total emissions
                </div>
              </div>
            }
          />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Per IFRS S2 §29(a)(iii), entity shall disclose the measurement approach and inputs
          used. B55-B56 require specific disclosure of the extent of primary-activity and
          verified data. Higher percentages indicate more reliable emission measurements.
        </p>
      </div>
    </div>
  );
}
