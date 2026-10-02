/**
 * IFRS S2 B62(a)(b) — Gross Exposure Matrix
 *
 * Displays financed emissions disaggregated by industry (GICS 6-digit) and
 * asset class, as required by IFRS S2 paragraph B62(a) and B62(b).
 *
 * Per IFRS S2 B62(b):
 *   "An entity shall disclose its absolute gross financed emissions…
 *   disaggregated by… (i) industry… (ii) asset class."
 *
 * This component renders the industry × asset class matrix with:
 * - Gross exposure in presentation currency (USD) per B62(b)
 * - Gross exposure in functional currency (NPR) for local context
 * - Loan count per cell
 * - Attributed CO2e tonnes (if available)
 */
"use client";

import React from "react";
import { formatUsd, formatNpr, formatNumber, formatCo2e } from "../../ui";

export type GrossExposureMatrixRow = {
  industry: string;
  assetClass: string;
  grossExposureUsd: number;
  loanCount: number;
  attributedCo2eTonnes?: number;
};

export function GrossExposureMatrix({
  data,
  showCo2e = false,
}: {
  data: GrossExposureMatrixRow[];
  showCo2e?: boolean;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-panel p-4 text-center text-sm text-slate-400">
        No gross exposure data available.
      </div>
    );
  }

  // Group by industry, then by asset class
  const industries = Array.from(new Set(data.map((r) => r.industry)));
  const assetClasses = Array.from(new Set(data.map((r) => r.assetClass)));

  // Create lookup map: industry → assetClass → row
  const matrix = new Map<string, Map<string, GrossExposureMatrixRow>>();
  data.forEach((row) => {
    if (!matrix.has(row.industry)) {
      matrix.set(row.industry, new Map());
    }
    matrix.get(row.industry)!.set(row.assetClass, row);
  });

  // USD/NPR conversion rate (hardcoded for demo; in production this would come from settings)
  const USD_TO_NPR = 133.5;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-line">
            <th className="sticky left-0 z-10 bg-panelAlt px-3 py-2 text-left font-semibold text-slate-300">
              Industry (GICS)
            </th>
            {assetClasses.map((ac) => (
              <th
                key={ac}
                className="px-3 py-2 text-right font-semibold text-slate-300"
              >
                {ac}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {industries.map((industry) => (
            <tr key={industry} className="border-b border-line/50">
              <td className="sticky left-0 z-10 bg-panelAlt px-3 py-2 font-medium text-slate-200">
                {industry}
              </td>
              {assetClasses.map((ac) => {
                const cell = matrix.get(industry)?.get(ac);
                if (!cell) {
                  return (
                    <td key={ac} className="px-3 py-2 text-center text-slate-600">
                      —
                    </td>
                  );
                }
                return (
                  <td key={ac} className="px-3 py-2 text-right">
                    <div className="space-y-0.5">
                      <div className="font-medium text-white">
                        {formatUsd(cell.grossExposureUsd)}
                      </div>
                      <div className="text-slate-400">
                        {formatNpr(cell.grossExposureUsd * USD_TO_NPR)}
                      </div>
                      <div className="text-slate-500">
                        {formatNumber(cell.loanCount)} loans
                      </div>
                      {showCo2e && cell.attributedCo2eTonnes !== undefined && (
                        <div className="text-amber-400">
                          {formatCo2e(cell.attributedCo2eTonnes)}
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
