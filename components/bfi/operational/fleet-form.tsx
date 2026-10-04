"use client";

/**
 * Fleet vehicle emissions form (Scope 1 mobile).
 *
 * Supports two calculation methods:
 *   A) Distance-based: km × emission factor (kg CO2e/km)
 *   B) Fuel-based: liters × emission factor (kg CO2e/liter)
 *
 * Must provide exactly ONE method (not both, not neither).
 *
 * Posts to /api/operational/fleet.
 */

import { useState, useEffect } from "react";
import { Panel } from "@/components/bfi/shared/primitives";

type FleetRecord = {
  id: string;
  period_start: string;
  period_end: string;
  vehicle_type: string;
  fuel_type: string;
  vehicle_id: string | null;
  distance_km: number | null;
  emission_factor_kg_co2e_per_km: number | null;
  fuel_consumed_liters: number | null;
  emission_factor_kg_co2e_per_liter: number | null;
  emission_factor_source: string;
  co2e_tonnes: number;
  notes: string | null;
  evidence_url: string | null;
  captured_at: string;
  officer_id: string;
};

type Method = "distance" | "fuel";

export function FleetForm() {
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [vehicleType, setVehicleType] = useState("car");
  const [fuelType, setFuelType] = useState("petrol");
  const [vehicleId, setVehicleId] = useState("");
  const [method, setMethod] = useState<Method>("distance");

  // Distance-based fields
  const [distanceKm, setDistanceKm] = useState("");
  const [emissionFactorKm, setEmissionFactorKm] = useState("");

  // Fuel-based fields
  const [fuelLiters, setFuelLiters] = useState("");
  const [emissionFactorLiter, setEmissionFactorLiter] = useState("");

  const [emissionFactorSource, setEmissionFactorSource] = useState("DEFRA 2024");
  const [notes, setNotes] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [records, setRecords] = useState<FleetRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  useEffect(() => {
    loadRecords();
  }, []);

  async function loadRecords() {
    setLoadingRecords(true);
    try {
      const res = await fetch("/api/operational/fleet");
      if (!res.ok) throw new Error(`GET ${res.status}`);
      const body = await res.json();
      if (body.ok) {
        setRecords(body.records);
      }
    } catch (err) {
      console.warn("[fleet-form] load failed", err);
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
      const payload: Record<string, unknown> = {
        periodStart,
        periodEnd,
        vehicleType,
        fuelType,
        vehicleId: vehicleId || undefined,
        emissionFactorSource,
        notes: notes || undefined,
        evidenceUrl: evidenceUrl || undefined,
      };

      if (method === "distance") {
        payload.distanceKm = parseFloat(distanceKm);
        payload.emissionFactorKgCo2ePerKm = parseFloat(emissionFactorKm);
      } else {
        payload.fuelConsumedLiters = parseFloat(fuelLiters);
        payload.emissionFactorKgCo2ePerLiter = parseFloat(emissionFactorLiter);
      }

      const res = await fetch("/api/operational/fleet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? `Server returned ${res.status}`);
      }

      setSuccess(
        `Saved! ${body.co2eTonnes.toFixed(2)} tCO₂e recorded for ${vehicleType}.`,
      );

      // Reset form
      setPeriodStart("");
      setPeriodEnd("");
      setVehicleType("car");
      setFuelType("petrol");
      setVehicleId("");
      setMethod("distance");
      setDistanceKm("");
      setEmissionFactorKm("");
      setFuelLiters("");
      setEmissionFactorLiter("");
      setEmissionFactorSource("DEFRA 2024");
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
            Record fleet vehicle emissions
          </div>
          <div className="text-sm text-slate-400">
            Mobile combustion — cars, vans, trucks, motorcycles
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

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Vehicle type <span className="text-red-400">*</span>
              </label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                required
                className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white"
              >
                <option value="car">Car</option>
                <option value="motorcycle">Motorcycle</option>
                <option value="van">Van</option>
                <option value="truck">Truck</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Fuel type <span className="text-red-400">*</span>
              </label>
              <select
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value)}
                required
                className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white"
              >
                <option value="petrol">Petrol</option>
                <option value="diesel">Diesel</option>
                <option value="cng">CNG</option>
                <option value="lpg">LPG</option>
                <option value="electric">Electric</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Vehicle ID
              </label>
              <input
                type="text"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                placeholder="e.g. Car-01"
                className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Calculation method toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Calculation method <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="distance"
                  checked={method === "distance"}
                  onChange={(e) => setMethod(e.target.value as Method)}
                  className="text-brand-primary"
                />
                <span className="text-sm text-slate-300">Distance-based (km traveled)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="fuel"
                  checked={method === "fuel"}
                  onChange={(e) => setMethod(e.target.value as Method)}
                  className="text-brand-primary"
                />
                <span className="text-sm text-slate-300">Fuel-based (liters consumed)</span>
              </label>
            </div>
          </div>

          {/* Distance-based fields */}
          {method === "distance" && (
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-line/60 bg-panel/40 p-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Distance (km) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                  required
                  className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Emission factor (kg CO₂e/km) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={emissionFactorKm}
                  onChange={(e) => setEmissionFactorKm(e.target.value)}
                  required
                  className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white"
                />
              </div>
            </div>
          )}

          {/* Fuel-based fields */}
          {method === "fuel" && (
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-line/60 bg-panel/40 p-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Fuel consumed (liters) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={fuelLiters}
                  onChange={(e) => setFuelLiters(e.target.value)}
                  required
                  className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Emission factor (kg CO₂e/liter) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={emissionFactorLiter}
                  onChange={(e) => setEmissionFactorLiter(e.target.value)}
                  required
                  className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-white"
                />
              </div>
            </div>
          )}

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
              placeholder="Link to logbook, fuel receipt, odometer reading"
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
            {records.length} fleet emission{records.length === 1 ? "" : "s"} on file
          </div>
        </div>

        {loadingRecords && (
          <div className="text-sm text-slate-400">Loading...</div>
        )}

        {!loadingRecords && records.length === 0 && (
          <div className="text-sm text-slate-500">
            No fleet emissions recorded yet. Use the form above to capture the first record.
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
                      {record.vehicle_type} ({record.fuel_type})
                      {record.vehicle_id && ` · ${record.vehicle_id}`}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {record.period_start} to {record.period_end}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {record.distance_km
                        ? `${record.distance_km.toLocaleString()} km × ${record.emission_factor_kg_co2e_per_km} kg CO₂e/km`
                        : `${record.fuel_consumed_liters?.toLocaleString()} L × ${record.emission_factor_kg_co2e_per_liter} kg CO₂e/L`}
                      {" · "}
                      {record.emission_factor_source}
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
