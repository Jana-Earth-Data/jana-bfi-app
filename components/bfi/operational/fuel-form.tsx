"use client";

/**
 * Fuel combustion emissions form (Scope 1 stationary).
 *
 * Captures:
 *   - Period (start/end dates)
 *   - Fuel type (diesel, natural gas, LPG, etc.)
 *   - Quantity + unit
 *   - Facility (optional)
 *   - Emission factor (kg CO2e per unit)
 *   - Emission factor source (DEFRA, IPCC, etc.)
 *   - Notes (optional)
 *   - Evidence URL (optional)
 *
 * Calculation:  CO2e tonnes = (quantity * emission factor) / 1000
 *
 * Posts to /api/operational/fuel.
 */

import { useState, useEffect } from "react";
import { Panel } from "@/components/bfi/shared/primitives";

type FuelRecord = {
  id: string;
  period_start: string;
  period_end: string;
  fuel_type: string;
  quantity: number;
  unit: string;
  facility: string | null;
  emission_factor_kg_co2e_per_unit: number;
  emission_factor_source: string;
  co2e_tonnes: number;
  notes: string | null;
  evidence_url: string | null;
  captured_at: string;
  officer_id: string;
};

export function FuelForm() {
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("liters");
  const [facility, setFacility] = useState("");
  const [emissionFactor, setEmissionFactor] = useState("");
  const [emissionFactorSource, setEmissionFactorSource] = useState("DEFRA 2024");
  const [notes, setNotes] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // Load historical records on mount
  useEffect(() => {
    loadRecords();
  }, []);

  async function loadRecords() {
    setLoadingRecords(true);
    try {
      const res = await fetch("/api/operational/fuel");
      if (!res.ok) throw new Error(`GET ${res.status}`);
      const body = await res.json();
      if (body.ok) {
        setRecords(body.records);
      }
    } catch (err) {
      console.warn("[fuel-form] load failed", err);
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
      const res = await fetch("/api/operational/fuel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodStart,
          periodEnd,
          fuelType,
          quantity: parseFloat(quantity),
          unit,
          facility: facility || undefined,
          emissionFactorKgCo2ePerUnit: parseFloat(emissionFactor),
          emissionFactorSource,
          notes: notes || undefined,
          evidenceUrl: evidenceUrl || undefined,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? `Server returned ${res.status}`);
      }

      setSuccess(
        `Saved! ${body.co2eTonnes.toFixed(2)} tCO₂e recorded for ${fuelType}.`,
      );

      // Reset form
      setPeriodStart("");
      setPeriodEnd("");
      setFuelType("");
      setQuantity("");
      setUnit("liters");
      setFacility("");
      setEmissionFactor("");
      setEmissionFactorSource("DEFRA 2024");
      setNotes("");
      setEvidenceUrl("");

      // Reload records
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
            Record fuel combustion
          </div>
          <div className="text-sm text-slate-400">
            Stationary combustion — diesel generators, natural gas boilers, LPG heating
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
              Fuel type <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value)}
              placeholder="e.g. diesel, natural gas, LPG"
              required
              className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white placeholder:text-slate-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Quantity <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Unit <span className="text-red-400">*</span>
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
                className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white"
              >
                <option value="liters">liters</option>
                <option value="m3">m³</option>
                <option value="kg">kg</option>
                <option value="tonnes">tonnes</option>
                <option value="kWh">kWh</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Facility
              </label>
              <input
                type="text"
                value={facility}
                onChange={(e) => setFacility(e.target.value)}
                placeholder="e.g. Head Office"
                className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Emission factor (kg CO₂e per {unit}) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="0.0001"
                value={emissionFactor}
                onChange={(e) => setEmissionFactor(e.target.value)}
                required
                className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Emission factor source <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={emissionFactorSource}
                onChange={(e) => setEmissionFactorSource(e.target.value)}
                placeholder="e.g. DEFRA 2024, IPCC 2006"
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
              placeholder="Link to utility bill, invoice, meter reading"
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
            {records.length} fuel emission{records.length === 1 ? "" : "s"} on file
          </div>
        </div>

        {loadingRecords && (
          <div className="text-sm text-slate-400">Loading...</div>
        )}

        {!loadingRecords && records.length === 0 && (
          <div className="text-sm text-slate-500">
            No fuel emissions recorded yet. Use the form above to capture the first record.
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
                      {record.fuel_type} — {record.quantity.toLocaleString()} {record.unit}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {record.period_start} to {record.period_end}
                      {record.facility && ` · ${record.facility}`}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      EF: {record.emission_factor_kg_co2e_per_unit} kg CO₂e/{record.unit} ({record.emission_factor_source})
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
