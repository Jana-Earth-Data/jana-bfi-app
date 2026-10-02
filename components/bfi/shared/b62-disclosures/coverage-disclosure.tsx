/**
 * IFRS S2 B62(c) — Coverage Disclosure
 *
 * Displays the percentage of gross carrying value of assets included in
 * financed emissions measurement, as required by IFRS S2 paragraph B62(c).
 *
 * Per IFRS S2 B62(c):
 *   "An entity shall disclose… the percentage of its gross carrying value of
 *   assets included in the measurement of financed emissions, and which types
 *   of assets are excluded from the measurement."
 *
 * This component shows:
 * - Coverage percentage (included / total gross exposure)
 * - Total vs included gross exposure amounts
 * - Loan counts (included vs excluded)
 * - List of excluded asset types
 * - Whether risk mitigants (guarantees, collateral) were excluded
 */
"use client";

import React from "react";
import { formatUsd, formatPercent, formatNumber } from "../../ui";
import { KpiCard, StatRow, Badge } from "../primitives";

export type GrossExposureCoverage = {
  totalGrossExposureUsd: number;
  includedGrossExposureUsd: number;
  coveragePercent: number;
  includedLoanCount: number;
  excludedLoanCount: number;
  excludedAssetTypes: string[];
  riskMitigantsExcluded: boolean;
  totalRiskMitigantValueUsd: number;
};

export function CoverageDisclosure({
  data,
}: {
  data: GrossExposureCoverage | undefined;
}) {
  if (!data) {
    return (
      <div className="rounded-lg border border-line bg-panel p-4 text-center text-sm text-slate-400">
        No coverage data available.
      </div>
    );
  }

  const {
    totalGrossExposureUsd,
    includedGrossExposureUsd,
    coveragePercent,
    includedLoanCount,
    excludedLoanCount,
    excludedAssetTypes,
    riskMitigantsExcluded,
    totalRiskMitigantValueUsd,
  } = data;

  return (
    <div className="space-y-4">
      {/* Coverage KPI */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Coverage Percentage"
          value={formatPercent(coveragePercent)}
          sublabel="Of gross exposure included in B62 measurement"
          accent
        />
        <KpiCard
          label="Included Exposure"
          value={formatUsd(includedGrossExposureUsd)}
          sublabel={`${formatNumber(includedLoanCount)} loans`}
        />
        <KpiCard
          label="Total Exposure"
          value={formatUsd(totalGrossExposureUsd)}
          sublabel={`${formatNumber(includedLoanCount + excludedLoanCount)} loans total`}
        />
      </div>

      {/* Detailed breakdown */}
      <div className="rounded-lg border border-line bg-panel p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-300">
          Measurement Scope
        </h4>
        <div className="space-y-0">
          <StatRow
            label="Included in measurement"
            value={
              <>
                {formatUsd(includedGrossExposureUsd)}{" "}
                <span className="text-slate-500">
                  ({formatNumber(includedLoanCount)} loans)
                </span>
              </>
            }
          />
          <StatRow
            label="Excluded from measurement"
            value={
              <>
                {formatUsd(totalGrossExposureUsd - includedGrossExposureUsd)}{" "}
                <span className="text-slate-500">
                  ({formatNumber(excludedLoanCount)} loans)
                </span>
              </>
            }
          />
        </div>
      </div>

      {/* Excluded asset types */}
      {excludedAssetTypes.length > 0 && (
        <div className="rounded-lg border border-line bg-panel p-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-300">
            Excluded Asset Types
          </h4>
          <div className="flex flex-wrap gap-2">
            {excludedAssetTypes.map((type) => (
              <Badge key={type} className="bg-slate-700/50 text-slate-300 border-slate-600">
                {type}
              </Badge>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            These asset types are excluded from B62 financed emissions measurement
            per IFRS S2 paragraph B62(c).
          </p>
        </div>
      )}

      {/* Risk mitigants note */}
      {riskMitigantsExcluded && totalRiskMitigantValueUsd > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <svg
              className="h-5 w-5 flex-shrink-0 text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1 text-xs">
              <p className="font-medium text-amber-200">
                Risk Mitigants Excluded
              </p>
              <p className="mt-1 text-amber-300/80">
                Guarantees, collateral, and other risk mitigants totaling{" "}
                {formatUsd(totalRiskMitigantValueUsd)} are excluded from gross
                exposure per IFRS S2 B62(c). Exposure represents bank's
                direct lending position.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
