/**
 * Auto-seed demo officers into bfi_officers on first use.
 *
 * The demo officer roster lives in lib/tenants/registry.ts (hardcoded). Several
 * API routes validate officers against the bfi_officers Supabase table, and the
 * bfi_loan_assignments / bfi_esdd_responses tables have FK constraints pointing
 * at bfi_officers(id). If the table hasn't been manually seeded via
 * POST /api/admin/seed-officers, any write that references an officer fails.
 *
 * This helper bridges the gap: it checks an in-memory set first (zero I/O on
 * the hot path), and only hits the DB on the very first call per tenant per
 * process. If the officer is in the registry but not in the DB, it auto-seeds
 * the entire tenant roster.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantConfig } from "@/lib/tenants/types";
import { getSupabaseAdmin } from "@/lib/data/supabase";

type OfficerRef = { id: string; name: string };

/**
 * In-memory set of tenants whose officers have been confirmed present in the
 * DB (or just seeded). Keyed by tenant id. Survives across requests within
 * one serverless process — on Vercel that means one cold-start cycle.
 */
const seededTenants = new Set<string>();

/**
 * Ensure the officer exists in bfi_officers. Returns { id, name } on success,
 * or null if the officer doesn't belong to this tenant at all.
 *
 * Hot path (>99% of calls): checks `seededTenants` set, returns immediately
 * from the registry. No DB round-trip.
 */
export async function ensureOfficerSeeded(
  supabase: SupabaseClient,
  tenant: TenantConfig,
  officerId: string,
): Promise<OfficerRef | null> {
  // Fast path: we already know this tenant's officers are seeded.
  if (seededTenants.has(tenant.id)) {
    const registryOfficer = tenant.demoOfficers.find((o) => o.id === officerId);
    return registryOfficer
      ? { id: registryOfficer.id, name: registryOfficer.name }
      : null;
  }

  // 1. Check the DB (first call per tenant per process).
  const { data: existing, error: lookupErr } = await supabase
    .from("bfi_officers")
    .select("id, name")
    .eq("bank_id", tenant.id)
    .eq("id", officerId)
    .maybeSingle();

  if (lookupErr) {
    console.error(
      `[ensure-seeded] officer lookup failed: ${lookupErr.message}`,
    );
    // Fall through to registry check — the table might not exist yet.
  }

  if (existing) {
    // Officer is in DB. Mark tenant as seeded so we skip the DB check next time.
    seededTenants.add(tenant.id);
    return { id: existing.id, name: existing.name };
  }

  // 2. Not in DB — check the hardcoded registry.
  const registryOfficer = tenant.demoOfficers.find((o) => o.id === officerId);
  if (!registryOfficer) {
    return null; // Not in registry either — genuinely invalid.
  }

  // 3. Auto-seed ALL of this tenant's officers (not just the requested one).
  //    This prevents repeated one-at-a-time inserts and ensures FK references
  //    from other officers' activity also resolve.
  const admin = getSupabaseAdmin();
  if (!admin) {
    console.error("[ensure-seeded] no Supabase admin client available");
    return null;
  }

  const rows = tenant.demoOfficers.map((o) => ({
    id: o.id,
    bank_id: tenant.id,
    name: o.name,
    role: o.role,
    email: o.email ?? null,
    origin: "demo",
  }));

  const { error: upsertErr } = await admin
    .from("bfi_officers")
    .upsert(rows, { onConflict: "id" });

  if (upsertErr) {
    console.error(
      `[ensure-seeded] officer auto-seed failed: ${upsertErr.message}`,
    );
    return null;
  }

  console.log(
    `[ensure-seeded] auto-seeded ${rows.length} officers for tenant ${tenant.id}`,
  );
  seededTenants.add(tenant.id);
  return { id: registryOfficer.id, name: registryOfficer.name };
}
