/**
 * POST /api/operational/electricity
 *   Body: ElectricityEmissionInput
 *   Creates a new electricity emission record (Scope 2, location-based) for the bank's operational footprint.
 *
 * GET /api/operational/electricity
 *   Returns all electricity emission records for the current tenant, optionally filtered by period.
 *
 * Both paths require:
 *   - A resolved tenant (from jana_demo_tenant cookie)
 *   - A resolved officer (from jana_demo_officer cookie)
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveCurrentTenant } from "@/lib/tenants";
import { apiError, requireOfficer, requireCaptureClient } from "@/lib/api/route-helpers";

export const dynamic = "force-dynamic";

type ElectricityEmissionInput = {
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  electricityConsumedKwh: number;
  facility?: string;
  meterNumber?: string;
  gridEmissionFactorKgCo2ePerKwh: number;
  emissionFactorSource: string;
  gridRegion?: string;
  notes?: string;
  evidenceUrl?: string;
};

export async function POST(request: NextRequest) {
  const [supabase, sbErr] = await requireCaptureClient();
  if (sbErr) return sbErr;
  const tenant = await resolveCurrentTenant();
  const [officer, offErr] = await requireOfficer("recording electricity emissions");
  if (offErr) return offErr;

  let body: Partial<ElectricityEmissionInput> = {};
  try {
    body = await request.json();
  } catch {
    return apiError("Body must be JSON.", 400);
  }

  const {
    periodStart,
    periodEnd,
    electricityConsumedKwh,
    facility,
    meterNumber,
    gridEmissionFactorKgCo2ePerKwh,
    emissionFactorSource,
    gridRegion,
    notes,
    evidenceUrl,
  } = body;

  // Validate required fields
  if (
    !periodStart ||
    !periodEnd ||
    electricityConsumedKwh === undefined ||
    gridEmissionFactorKgCo2ePerKwh === undefined ||
    !emissionFactorSource
  ) {
    return apiError(
      "periodStart, periodEnd, electricityConsumedKwh, gridEmissionFactorKgCo2ePerKwh, and emissionFactorSource are required.",
      400,
    );
  }

  if (electricityConsumedKwh < 0) {
    return apiError("electricityConsumedKwh must be non-negative.", 400);
  }

  if (gridEmissionFactorKgCo2ePerKwh < 0) {
    return apiError("gridEmissionFactorKgCo2ePerKwh must be non-negative.", 400);
  }

  // Calculate CO2e tonnes (kWh * kg CO2e/kWh / 1000)
  const co2eTonnes = (electricityConsumedKwh * gridEmissionFactorKgCo2ePerKwh) / 1000;

  const { data, error } = await supabase
    .from("bfi_operational_electricity")
    .insert({
      bank_id: tenant.id,
      officer_id: officer.id,
      period_start: periodStart,
      period_end: periodEnd,
      electricity_consumed_kwh: electricityConsumedKwh,
      facility: facility || null,
      meter_number: meterNumber || null,
      grid_emission_factor_kg_co2e_per_kwh: gridEmissionFactorKgCo2ePerKwh,
      emission_factor_source: emissionFactorSource,
      grid_region: gridRegion || null,
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
  const [_officer, authErr] = await requireOfficer("viewing electricity emissions");
  if (authErr) return authErr;

  const [supabase, sbErr] = await requireCaptureClient();
  if (sbErr) return sbErr;
  const tenant = await resolveCurrentTenant();

  // Optional filters
  const periodStart = request.nextUrl.searchParams.get("periodStart");
  const periodEnd = request.nextUrl.searchParams.get("periodEnd");

  let query = supabase
    .from("bfi_operational_electricity")
    .select(
      "id, period_start, period_end, electricity_consumed_kwh, facility, meter_number, grid_emission_factor_kg_co2e_per_kwh, emission_factor_source, grid_region, co2e_tonnes, notes, evidence_url, captured_at, officer_id",
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
