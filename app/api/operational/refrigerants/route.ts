/**
 * POST /api/operational/refrigerants
 *   Body: RefrigerantEmissionInput
 *   Creates a new refrigerant fugitive emission record for the bank's operational footprint.
 *
 * GET /api/operational/refrigerants
 *   Returns all refrigerant emission records for the current tenant, optionally filtered by period.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveCurrentTenant } from "@/lib/tenants";
import { apiError, requireOfficer, requireCaptureClient } from "@/lib/api/route-helpers";

export const dynamic = "force-dynamic";

type RefrigerantEmissionInput = {
  periodStart: string;
  periodEnd: string;
  refrigerantType: string;
  quantityKg: number;
  facility?: string;
  systemType?: string;
  eventType?: string;
  gwp100: number;
  gwpSource: string;
  notes?: string;
  evidenceUrl?: string;
};

export async function POST(request: NextRequest) {
  const [supabase, sbErr] = await requireCaptureClient();
  if (sbErr) return sbErr;
  const tenant = await resolveCurrentTenant();
  const [officer, offErr] = await requireOfficer("recording refrigerant emissions");
  if (offErr) return offErr;

  let body: Partial<RefrigerantEmissionInput> = {};
  try {
    body = await request.json();
  } catch {
    return apiError("Body must be JSON.", 400);
  }

  const {
    periodStart,
    periodEnd,
    refrigerantType,
    quantityKg,
    facility,
    systemType,
    eventType,
    gwp100,
    gwpSource,
    notes,
    evidenceUrl,
  } = body;

  // Validate required fields
  if (
    !periodStart ||
    !periodEnd ||
    !refrigerantType ||
    quantityKg === undefined ||
    gwp100 === undefined ||
    !gwpSource
  ) {
    return apiError(
      "periodStart, periodEnd, refrigerantType, quantityKg, gwp100, and gwpSource are required.",
      400,
    );
  }

  if (quantityKg < 0) {
    return apiError("quantityKg must be non-negative.", 400);
  }

  if (gwp100 <= 0) {
    return apiError("gwp100 must be positive.", 400);
  }

  // Calculate CO2e tonnes (kg refrigerant * GWP / 1000)
  const co2eTonnes = (quantityKg * gwp100) / 1000;

  const { data, error } = await supabase
    .from("bfi_operational_refrigerants")
    .insert({
      bank_id: tenant.id,
      officer_id: officer.id,
      period_start: periodStart,
      period_end: periodEnd,
      refrigerant_type: refrigerantType,
      quantity_kg: quantityKg,
      facility: facility || null,
      system_type: systemType || null,
      event_type: eventType || null,
      gwp_100: gwp100,
      gwp_source: gwpSource,
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
  const [_officer, authErr] = await requireOfficer("viewing refrigerant emissions");
  if (authErr) return authErr;

  const [supabase, sbErr] = await requireCaptureClient();
  if (sbErr) return sbErr;
  const tenant = await resolveCurrentTenant();

  const periodStart = request.nextUrl.searchParams.get("periodStart");
  const periodEnd = request.nextUrl.searchParams.get("periodEnd");

  let query = supabase
    .from("bfi_operational_refrigerants")
    .select(
      "id, period_start, period_end, refrigerant_type, quantity_kg, facility, system_type, event_type, gwp_100, gwp_source, co2e_tonnes, notes, evidence_url, captured_at, officer_id",
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
