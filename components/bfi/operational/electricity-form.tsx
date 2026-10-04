"use client";

/**
 * Electricity emissions form (Scope 2 location-based).
 *
 * Location-based method is mandatory per IFRS S2 B30. Market-based method
 * (contractual instruments like RECs, PPAs) is optional and not yet implemented.
 *
 * Calculation: CO2e tonnes = (kWh * grid emission factor) / 1000
 *
 * Grid emission factors are typically provided by:
 *   - National electricity authorities (e.g. Nepal Electricity Authority)
 *   - IEA (International Energy Agency)
 *   - IPCC 2006 Guidelines
 *
 * Posts to /api/operational/electricity.
 */

import { useState, useEffect } from "react";
import { Panel } from "@/components/bfi/shared/primitives";

type ElectricityRecord = {
  id: string;
  period_start: string;
  period_end: string;
  electricity_consumed_kwh: number;
  facility: string | null;
  meter_number: string | null;
  grid_emission_factor_kg_co2e_per_kwh: number;
  emission_factor_source: string;
  grid_region: string | null;
  co2e_tonnes: number;
  notes: string | null;
  evidence_url: string | null;
  captured_at: string;
  officer_id: string;
};

export function ElectricityForm() {
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [electricityKwh, setElectricityKwh] = useState("");
  const [facility, setFacility] = useState("");
  const [meterNumber, setMeterNumber] = useState("");
  const [gridEmissionFactor, setGridEmissionFactor] = useState("");
  const [emissionFactorSource, setEmissionFactorSource] = useState("IEA 2024");
  const [gridRegion, setGridRegion] = useState("Nepal");
  const [notes, setNotes] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [records, setRecords] = useState<ElectricityRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  useEffect(() => {
    loadRecords();
  }, []);

  async function loadRecords() {
    setLoadingRecords(true);
    try {
      const res = await fetch("/api/operational/electricity");
      if (!res.ok) throw new Error(`GET ${res.status}`);
      const body = await res.json();
      if (body.ok) {
        setRecords(body.records);
      }
    } catch (err) {
      console.warn("[electricity-form] load failed", err);
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
      const res = await fetch("/api/operational/electricity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodStart,
          periodEnd,
          electricityConsumedKwh: parseFloat(electricityKwh),
          facility: facility || undefined,
          meterNumber: meterNumber || undefined,
          gridEmissionFactorKgCo2ePerKwh: parseFloat(gridEmissionFactor),
          emissionFactorSource,
          gridRegion: gridRegion || undefined,
          notes: notes || undefined,
          evidenceUrl: evidenceUrl || undefined,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? `Server returned ${res.status}`);
      }

      setSuccess(
        `Saved! ${body.co2eTonnes.toFixed(2)} tCO₂e recorded for ${parseFloat(electricityKwh).toLocaleString()} kWh.`,
      );

      // Reset form
      setPeriodStart("");
      setPeriodEnd("");
      setElectricityKwh("");
      setFacility("");
      setMeterNumber("");
      setGridEmissionFactor("");
      setEmissionFactorSource("IEA 2024");
      setGridRegion("Nepal");
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
            Record electricity emissions
          </div>
          <div className="text-sm text-slate-400">
            Scope 2 — location-based method (mandatory per IFRS S2 B30)
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

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Electricity consumed (kWh) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={electricityKwh}
              onChange={(e) => setElectricityKwh(e.target.value)}
              required
              className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white"
            />
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
                placeholder="e.g. Head Office, Branch 10"
                className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Meter number
              </label>
              <input
                type="text"
                value={meterNumber}
                onChange={(e) => setMeterNumber(e.target.value)}
                placeholder="Utility meter reference"
                className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Grid region
              </label>
              <input
                type="text"
                value={gridRegion}
                onChange={(e) => setGridRegion(e.target.value)}
                placeholder="e.g. Nepal, India"
                className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Grid emission factor (kg CO₂e/kWh) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="0.0001"
                value={gridEmissionFactor}
                onChange={(e) => setGridEmissionFactor(e.target.value)}
                required
                className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white"
              />
              <div className="mt-1 text-xs text-slate-500">
                Nepal: ~0.0002 kg CO₂e/kWh (mostly hydro). Check IEA or NEA for current value.
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Emission factor source <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={emissionFactorSource}
                onChange={(e) => setEmissionFactorSource(e.target.value)}
                placeholder="e.g. IEA 2024, Nepal Electricity Authority"
                required
                className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
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
              placeholder="Link to utility bill, meter reading"
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
            {records.length} electricity emission{records.length === 1 ? "" : "s"} on file
          </div>
        </div>

        {loadingRecords && (
          <div className="text-sm text-slate-400">Loading...</div>
        )}

        {!loadingRecords && records.length === 0 && (
          <div className="text-sm text-slate-500">
            No electricity emissions recorded yet. Use the form above to capture the first record.
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
                      {record.electricity_consumed_kwh.toLocaleString()} kWh
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {record.period_start} to {record.period_end}
                      {record.facility && ` · ${record.facility}`}
                      {record.meter_number && ` · Meter ${record.meter_number}`}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Grid factor: {record.grid_emission_factor_kg_co2e_per_kwh} kg CO₂e/kWh ({record.emission_factor_source})
                      {record.grid_region && ` · ${record.grid_region}`}
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
