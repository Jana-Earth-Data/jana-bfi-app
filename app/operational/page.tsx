/**
 * Operational emissions capture dashboard.
 *
 * Officer-facing interface for capturing the bank's own Scope 1 and Scope 2
 * emissions per IFRS S2 §29(a)(i) and (v). Four emission types:
 *   - Fuel combustion (stationary, Scope 1)
 *   - Fleet vehicles (mobile, Scope 1)
 *   - Refrigerants (fugitive, Scope 1)
 *   - Electricity (Scope 2, location-based)
 *
 * Not loan-specific — these are bank-level operational footprint captures.
 * Each form posts to /api/operational/{type} and attribution is automatic
 * (bank_id from tenant cookie, officer_id from officer cookie).
 */

import { redirect } from "next/navigation";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { TenantThemeProvider } from "@/components/bfi/tenant-theme";
import { OperationalDashboard } from "@/components/bfi/operational/dashboard";

export const dynamic = "force-dynamic";

export default async function OperationalPage() {
  const tenant = await resolveCurrentTenant();
  const officer = await resolveCurrentOfficer();

  if (!officer) {
    redirect(
      `/?openOfficerPicker=1&returnTo=${encodeURIComponent("/operational")}`,
    );
  }

  return (
    <TenantThemeProvider tenant={tenant}>
      <OperationalDashboard
        tenantName={tenant.branding.displayName}
        officer={officer}
      />
    </TenantThemeProvider>
  );
}
