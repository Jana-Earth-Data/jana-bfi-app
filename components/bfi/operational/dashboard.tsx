"use client";

/**
 * Operational emissions capture dashboard.
 *
 * Four-tab interface for capturing the bank's own emissions:
 *   - Fuel (Scope 1 stationary)
 *   - Fleet (Scope 1 mobile)
 *   - Refrigerants (Scope 1 fugitive)
 *   - Electricity (Scope 2 location-based)
 *
 * Each tab shows a form for new captures and a list of historical records.
 * Evidence attachments are supported via the shared EvidenceAttachments
 * component (same pattern as PCAF / CAP).
 */

import { useState } from "react";
import type { Officer } from "@/lib/tenants";
import { FuelForm } from "./fuel-form";
import { FleetForm } from "./fleet-form";
import { RefrigerantsForm } from "./refrigerants-form";
import { ElectricityForm } from "./electricity-form";

const ROLE_LABEL: Record<Officer["role"], string> = {
  loan_officer: "Loan officer",
  esg_officer: "ESG officer",
  compliance: "Compliance",
  credit_committee: "Credit committee",
};

type Tab = "fuel" | "fleet" | "refrigerants" | "electricity";

export function OperationalDashboard({
  tenantName,
  officer,
}: {
  tenantName: string;
  officer: Officer;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("fuel");

  return (
    <div className="min-h-screen bg-surface text-slate-100">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              {tenantName} — Operational footprint capture
            </div>
            <div className="text-base font-semibold text-white">
              Scope 1 &amp; 2 emissions
            </div>
            <div className="text-xs text-slate-400">
              IFRS S2 §29(a)(i), (v) — Bank&apos;s own operational emissions
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs">
              <div className="text-slate-300">{officer.name}</div>
              <div className="text-slate-500">{ROLE_LABEL[officer.role]}</div>
            </div>
            <a
              href="/"
              className="rounded-md border border-line bg-panel px-3 py-1 text-xs text-slate-300 hover:bg-line/30"
            >
              Return to dashboard
            </a>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-line/60 bg-surface">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex gap-1">
            <TabButton
              active={activeTab === "fuel"}
              onClick={() => setActiveTab("fuel")}
              label="Fuel combustion"
              scope="Scope 1"
            />
            <TabButton
              active={activeTab === "fleet"}
              onClick={() => setActiveTab("fleet")}
              label="Fleet vehicles"
              scope="Scope 1"
            />
            <TabButton
              active={activeTab === "refrigerants"}
              onClick={() => setActiveTab("refrigerants")}
              label="Refrigerants"
              scope="Scope 1"
            />
            <TabButton
              active={activeTab === "electricity"}
              onClick={() => setActiveTab("electricity")}
              label="Electricity"
              scope="Scope 2"
            />
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        {activeTab === "fuel" && <FuelForm />}
        {activeTab === "fleet" && <FleetForm />}
        {activeTab === "refrigerants" && <RefrigerantsForm />}
        {activeTab === "electricity" && <ElectricityForm />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  scope,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  scope: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-4 py-3 text-sm font-medium transition ${
        active
          ? "border-brand-primary text-white"
          : "border-transparent text-slate-400 hover:text-slate-200"
      }`}
    >
      {label}
      <span className="ml-2 text-xs text-slate-500">({scope})</span>
    </button>
  );
}
