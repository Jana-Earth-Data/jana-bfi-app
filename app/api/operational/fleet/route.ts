/**
 * POST /api/operational/fleet
 *   Body: FleetEmissionInput
 *   Creates a new fleet vehicle emission record for the bank's operational footprint.
 *   Supports both distance-based and fuel-based calculations.
 *
 * GET /api/operational/fleet
 *   Returns all fleet emission records for the current tenant, optionally filtered by period.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveCurrentTenant } from "@/lib/tenants";
import { apiError, requireOfficer, requireCaptureClient } from "@/lib/api/route-helpers";

export const dynamic = "force-dynamic";

type FleetEmissionInput = {
  periodStart: string;
  periodEnd: string;
  vehicleType: string;
  fuelType: string;
  vehicleId?: string;
  // One of these two methods:
  distanceKm?: number;
  emissionFactorKgCo2ePerKm?: number;
  fuelConsumedLiters?: number;
  emissionFactorKgCo2ePerLiter?: number;
  // Common:
  emissionFactorSource: string;
  notes?: string;
  evidenceUrl?: string;
};

export async function POST(request: NextRequest) {
  const [supabase, sbErr] = await requireCaptureClient();
  if (sbErr) return sbErr;
  const tenant = await resolveCurrentTenant();
  const [officer, offErr] = await requireOfficer("recording fleet emissions");
  if (offErr) return offErr;

  let body: Partial<FleetEmissionInput> = {};
  try {
    body = await request.json();
  } catch {
    return apiError("Body must be JSON.", 400);
  }

  const {
    periodStart,
    periodEnd,
    vehicleType,
    fuelType,
    vehicleId,
    distanceKm,
    emissionFactorKgCo2ePerKm,
    fuelConsumedLiters,
    emissionFactorKgCo2ePerLiter,
    emissionFactorSource,
    notes,
    evidenceUrl,
  } = body;

  // Validate required fields
  if (!periodStart || !periodEnd || !vehicleType || !fuelType || !emissionFactorSource) {
    return apiError(
      "periodStart, periodEnd, vehicleType, fuelType, and emissionFactorSource are required.",
      400,
    );
  }

  // Must have exactly one method: distance-based OR fuel-based
  const hasDistance = distanceKm !== undefined && emissionFactorKgCo2ePerKm !== undefined;
  const hasFuel =
    fuelConsumedLiters !== undefined && emissionFactorKgCo2ePerLiter !== undefined;

  if ((!hasDistance && !hasFuel) || (hasDistance && hasFuel)) {
    return apiError(
      "Must provide either (distanceKm + emissionFactorKgCo2ePerKm) OR (fuelConsumedLiters + emissionFactorKgCo2ePerLiter), not both or neither.",
      400,
    );
  }

  // Calculate CO2e tonnes
  let co2eTonnes: number;
  if (hasDistance) {
    if (distanceKm! < 0 || emissionFactorKgCo2ePerKm! < 0) {
      return apiError("distanceKm and emissionFactorKgCo2ePerKm must be non-negative.", 400);
    }
    co2eTonnes = (distanceKm! * emissionFactorKgCo2ePerKm!) / 1000;
  } else {
    if (fuelConsumedLiters! < 0 || emissionFactorKgCo2ePerLiter! < 0) {
      return apiError(
        "fuelConsumedLiters and emissionFactorKgCo2ePerLiter must be non-negative.",
        400,
      );
    }
    co2eTonnes = (fuelConsumedLiters! * emissionFactorKgCo2ePerLiter!) / 1000;
  }

  const { data, error } = await supabase
    .from("bfi_operational_fleet")
    .insert({
      bank_id: tenant.id,
      officer_id: officer.id,
      period_start: periodStart,
      period_end: periodEnd,
      vehicle_type: vehicleType,
      fuel_type: fuelType,
      vehicle_id: vehicleId || null,
      distance_km: distanceKm ?? null,
      emission_factor_kg_co2e_per_km: emissionFactorKgCo2ePerKm ?? null,
      fuel_consumed_liters: fuelConsumedLiters ?? null,
      emission_factor_kg_co2e_per_liter: emissionFactorKgCo2ePerLiter ?? null,
      emission_factor_source: emissionFactorSource,
      co2e_tonnes: co2eTonnes,
      notes: notes || null,
      evidence_url: evidenceUrl || null,
    })
    .select("id, captured_at, co2e_tonnes")
    .single();

  if (error) {
    return NextResponse.json({ error: `Insert failed: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    capturedAt: data.captured_at,
    co2eTonnes: data.co2e_tonnes,
    officer: { id: officer.id, name: officer.name, role: officer.role },
  });
}

export async function GET(request: NextRequest) {
  const [_officer, authErr] = await requireOfficer("viewing fleet emissions");
  if (authErr) return authErr;

  const [supabase, sbErr] = await requireCaptureClient();
  if (sbErr) return sbErr;
  const tenant = await resolveCurrentTenant();

  const periodStart = request.nextUrl.searchParams.get("periodStart");
  const periodEnd = request.nextUrl.searchParams.get("periodEnd");

  let query = supabase
    .from("bfi_operational_fleet")
    .select(
      "id, period_start, period_end, vehicle_type, fuel_type, vehicle_id, distance_km, emission_factor_kg_co2e_per_km, fuel_consumed_liters, emission_factor_kg_co2e_per_liter, emission_factor_source, co2e_tonnes, notes, evidence_url, captured_at, officer_id",
    )
    .eq("bank_id", tenant.id)
    .order("period_start", { ascending: false });

  if (periodStart) {
    query = query.gte("period_start", periodStart);
  }
  if (periodEnd) {
    query = query.lte("period_end", periodEnd);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: `Query failed: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    records: data ?? [],
  });
}
