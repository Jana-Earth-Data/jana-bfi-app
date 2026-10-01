"use client";

/**
 * Refrigerant fugitive emissions form (Scope 1).
 *
 * Captures refrigerant leaks/recharges from HVAC and refrigeration systems.
 *
 * Calculation: CO2e tonnes = (quantity_kg * GWP_100) / 1000
 *
 * GWP (Global Warming Potential) values come from IPCC AR5/AR6 reports.
 * Common refrigerants:
 *   - R-410A: GWP 2,088
 *   - R-134a: GWP 1,430
 *   - R-32: GWP 675
 *
 * Posts to /api/operational/refrigerants.
 */

import { useState, useEffect } from "react";
import { Panel } from "@/components/bfi/shared/primitives";

type RefrigerantRecord = {
  id: string;
  period_start: string;
  period_end: string;
  refrigerant_type: string;
  quantity_kg: number;
  facility: string | null;
  system_type: string | null;
  event_type: string | null;
  gwp_100: number;
  gwp_source: string;
  co2e_tonnes: number;
  notes: string | null;
  evidence_url: string | null;
  captured_at: string;
  officer_id: string;
};

export function RefrigerantsForm() {
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [refrigerantType, setRefrigerantType] = useState("");
  const [quantityKg, setQuantityKg] = useState("");
  const [facility, setFacility] = useState("");
  const [systemType, setSystemType] = useState("");
  const [eventType, setEventType] = useState("");
  const [gwp100, setGwp100] = useState("");
  const [gwpSource, setGwpSource] = useState("IPCC AR6");
  const [notes, setNotes] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [records, setRecords] = useState<RefrigerantRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  useEffect(() => {
    loadRecords();
  }, []);

  async function loadRecords() {
    setLoadingRecords(true);
    try {
      const res = await fetch("/api/operational/refrigerants");
      if (!res.ok) throw new Error(`GET ${res.status}`);
      const body = await res.json();
      if (body.ok) {
        setRecords(body.records);
      }
    } catch (err) {
      console.warn("[refrigerants-form] load failed", err);
    } finally {
      setLoadingRecords(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/operational/refrigerants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodStart,
          periodEnd,
          refrigerantType,
          quantityKg: parseFloat(quantityKg),
          facility: facility || undefined,
          systemType: systemType || undefined,
          eventType: eventType || undefined,
          gwp100: parseFloat(gwp100),
          gwpSource,
          notes: notes || undefined,
          evidenceUrl: evidenceUrl || undefined,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? `Server returned ${res.status}`);
      }

      setSuccess(
        `Saved! ${body.co2eTonnes.toFixed(2)} tCO₂e recorded for ${refrigerantType}.`,
      );

      // Reset form
      setPeriodStart("");
      setPeriodEnd("");
      setRefrigerantType("");
      setQuantityKg("");
      setFacility("");
      setSystemType("");
      setEventType("");
      setGwp100("");
      setGwpSource("IPCC AR6");
      setNotes("");
      setEvidenceUrl("");

      loadRecords();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Panel>
        <div className="mb-4 border-b border-line/60 pb-3">
          <div className="text-lg font-semibold text-white">
            Record refrigerant emissions
          </div>
          <div className="text-sm text-slate-400">
            Fugitive emissions from HVAC and refrigeration systems
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Period start <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                required
                className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Period end <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                required
                className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Refrigerant type <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={refrigerantType}
                onChange={(e) => setRefrigerantType(e.target.value)}
                placeholder="e.g. R-410A, R-134a, R-32"
                required
                className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
              <div className="mt-1 text-xs text-slate-500">
                Common: R-410A (GWP 2,088), R-134a (GWP 1,430), R-32 (GWP 675)
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Quantity (kg) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={quantityKg}
                onChange={(e) => setQuantityKg(e.target.value)}
                required
                className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Facility
              </label>
              <input
                type="text"
                value={facility}
                onChange={(e) => setFacility(e.target.value)}
                placeholder="e.g. Head Office HVAC"
                className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                System type
              </label>
              <select
                value={systemType}
                onChange={(e) => setSystemType(e.target.value)}
                className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white"
              >
                <option value="">Select...</option>
                <option value="hvac">HVAC</option>
                <option value="refrigeration">Refrigeration</option>
                <option value="chiller">Chiller</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Event type
              </label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white"
              >
                <option value="">Select...</option>
                <option value="annual-servicing">Annual servicing</option>
                <option value="leak-repair">Leak repair</option>
                <option value="recharge">Recharge</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                GWP-100 <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={gwp100}
                onChange={(e) => setGwp100(e.target.value)}
                placeholder="Global Warming Potential (100-year)"
                required
                className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
              <div className="mt-1 text-xs text-slate-500">
                Look up GWP value for your refrigerant type in IPCC AR5/AR6
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                GWP source <span className="text-red-400">*</span>
              </label>
              <select
                value={gwpSource}
                onChange={(e) => setGwpSource(e.target.value)}
                required
                className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white"
              >
                <option value="IPCC AR6">IPCC AR6</option>
                <option value="IPCC AR5">IPCC AR5</option>
                <option value="IPCC AR4">IPCC AR4</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white placeholder:text-slate-500"
              placeholder="Optional notes or context"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Evidence URL
            </label>
            <input
              type="url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="Link to service record, leak report, invoice"
              className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white placeholder:text-slate-500"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-md border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-300">
              {success}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Record emission"}
            </button>
          </div>
        </form>
      </Panel>

      {/* Historical records */}
      <Panel>
        <div className="mb-4 border-b border-line/60 pb-3">
          <div className="text-lg font-semibold text-white">
            Historical records
          </div>
          <div className="text-sm text-slate-400">
            {records.length} refrigerant emission{records.length === 1 ? "" : "s"} on file
          </div>
        </div>

        {loadingRecords && (
          <div className="text-sm text-slate-400">Loading...</div>
        )}

        {!loadingRecords && records.length === 0 && (
          <div className="text-sm text-slate-500">
            No refrigerant emissions recorded yet. Use the form above to capture the first record.
          </div>
        )}

        {!loadingRecords && records.length > 0 && (
          <div className="space-y-3">
            {records.map((record) => (
              <div
                key={record.id}
                className="rounded-lg border border-line bg-panelAlt px-4 py-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-white">
                      {record.refrigerant_type} — {record.quantity_kg} kg
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {record.period_start} to {record.period_end}
                      {record.facility && ` · ${record.facility}`}
                      {record.system_type && ` · ${record.system_type}`}
                      {record.event_type && ` · ${record.event_type}`}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      GWP: {record.gwp_100.toLocaleString()} ({record.gwp_source})
                    </div>
                    {record.notes && (
                      <div className="mt-2 text-xs text-slate-400 italic">
                        {record.notes}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-400">
                      {record.co2e_tonnes.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-500">tCO₂e</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
