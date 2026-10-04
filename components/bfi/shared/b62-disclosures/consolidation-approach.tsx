/**
 * IFRS S2 B27 — Consolidation Approach Disclosure
 *
 * Displays the basis of consolidation used to measure financed emissions,
 * as required by IFRS S2 paragraph B27.
 *
 * Per IFRS S2 B27:
 *   "An entity shall disclose... whether its measure of financed emissions
 *   is based on the equity share in an investee or on the entity's share
 *   of the investee's total debt and equity, and the reasons for its
 *   choice of measurement basis."
 *
 * This component shows:
 * - The approach used (equity-share or control)
 * - The reason for choosing that approach
 * - Explanation of PCAF standard alignment
 */
"use client";

import React from "react";
import { Badge, StatRow } from "../primitives";

export type ConsolidationApproach = {
  approach: "equity-share" | "control";
  reason: string;
};

const APPROACH_LABELS: Record<string, string> = {
  "equity-share": "Equity Share (PCAF Standard)",
  control: "Control Approach",
};

const APPROACH_DESCRIPTIONS: Record<string, string> = {
  "equity-share":
    "Attribution factor based on entity's proportional ownership (equity + debt) relative to total enterprise value. Aligns with PCAF Global GHG Accounting and Reporting Standard §5.1.",
  control:
    "Attribution based on financial control consolidation principles. All emissions of controlled entities are attributed to the reporting entity.",
};

export function ConsolidationApproach({
  data,
}: {
  data: ConsolidationApproach | undefined;
}) {
  if (!data) {
    return (
      <div className="rounded-lg border border-line bg-panel p-4 text-center text-sm text-slate-400">
        No consolidation approach disclosure available.
      </div>
    );
  }

  const { approach, reason } = data;

  return (
    <div className="space-y-4">
      {/* Approach Summary */}
      <div className="rounded-lg border border-line bg-panel p-4">
        <div className="mb-4 flex items-center gap-3">
          <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/50 font-medium">
            {APPROACH_LABELS[approach] || approach}
          </Badge>
          {approach === "equity-share" && (
            <span className="text-xs text-slate-400">(PCAF Standard Alignment)</span>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
              Measurement Basis
            </h4>
            <p className="text-sm text-slate-300">
              {APPROACH_DESCRIPTIONS[approach] || "No description available."}
            </p>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
              Reason for Choice
            </h4>
            <p className="text-sm text-slate-300">{reason}</p>
          </div>
        </div>
      </div>

      {/* Methodology Note */}
      <div className="rounded-lg border border-line bg-panel p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-300">
          Attribution Formula
        </h4>
        <div className="space-y-0">
          {approach === "equity-share" ? (
            <>
              <StatRow
                label="Attribution Factor"
                value={
                  <code className="text-xs text-slate-300 font-mono">
                    (Outstanding Loan Amount) / (Total Debt + Equity)
                  </code>
                }
              />
              <StatRow
                label="Attributed Emissions"
                value={
                  <code className="text-xs text-slate-300 font-mono">
                    Borrower Emissions × Attribution Factor
                  </code>
                }
              />
            </>
          ) : (
            <StatRow
              label="Attributed Emissions"
              value={
                <code className="text-xs text-slate-300 font-mono">
                  100% of controlled entity emissions
                </code>
              }
            />
          )}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {approach === "equity-share"
            ? "Per PCAF Global GHG Accounting and Reporting Standard Part A 3rd Edition §5.1. The equity-share approach allocates emissions proportional to the lender's financial interest in the borrower."
            : "Per IFRS S2 B27. The control approach attributes 100% of emissions from entities under financial control, regardless of ownership percentage."}
        </p>
      </div>
    </div>
  );
}
