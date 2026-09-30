/**
 * POST /api/tenant/set-code
 *
 * Body: { code: string }  (empty string means "continue as default")
 *
 * Validates the code against the registry. On success (matched or
 * fell-through to default), sets the tenant cookie and returns the
 * resolved tenant. On outright failure (e.g. body malformed) returns
 * a 400. Never leaks the list of registered codes.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  findTenantByCode,
  getDefaultTenant,
  isPlausibleCode,
  TENANT_COOKIE_MAX_AGE_SECONDS,
  TENANT_COOKIE_NAME,
} from "@/lib/tenants";
import { DEMO_MODE_COOKIE } from "@/lib/demo/mode";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let raw = "";
  try {
    const body = await request.json();
    raw = typeof body?.code === "string" ? body.code : "";
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON with a `code` string." },
      { status: 400 },
    );
  }

  const codeStr = raw.trim();

  // Empty code = "continue as default" (the button on the landing page).
  // Non-empty code = validate; unknown code silently falls back to default.
  let tenant;
  let matched = false;
  if (!codeStr) {
    tenant = getDefaultTenant();
  } else if (!isPlausibleCode(codeStr)) {
    tenant = getDefaultTenant();
  } else {
    const found = findTenantByCode(codeStr);
    if (found) {
      tenant = found;
      matched = true;
    } else {
      tenant = getDefaultTenant();
    }
  }

  const response = NextResponse.json({
    ok: true,
    matched,
    tenantId: tenant.id,
    displayName: tenant.branding.displayName,
  });
  response.cookies.set(TENANT_COOKIE_NAME, tenant.id, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: TENANT_COOKIE_MAX_AGE_SECONDS,
  });
  // Entering a bank is a fresh start for this user's demo-mode choice.
  //
  // A real bank code (matched) returns the session to the default, which is
  // OFF -- production data (lib/demo/mode.ts: an absent cookie means off).
  //
  // "Continue as … (demo)" -- no code, or an unrecognised one -- lands on the
  // fictional default bank, which only has anything to show in demo mode, so
  // it switches demo ON for this session. Session-scoped (no maxAge), the same
  // semantics as the toggle route, and it affects only this user.
  if (matched) {
    response.cookies.set(DEMO_MODE_COOKIE, "", {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  } else {
    response.cookies.set(DEMO_MODE_COOKIE, "on", {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
    });
  }
  return response;
}
