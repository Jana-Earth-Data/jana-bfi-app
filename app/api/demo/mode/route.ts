/**
 * POST /api/demo/mode  { on: boolean }
 *
 * Toggles demo mode for this browser session only. It affects this user's
 * view; nobody else's.
 *
 * Refuses outright when the demo switch is not available on this deployment
 * (JANA_DEMO unset). There, isDemoMode() ignores the cookie, so setting it
 * would change nothing. Better to say the switch is unavailable than to
 * accept the request and appear to have done something.
 *
 * The cookie is a convenience, not a security boundary: what keeps
 * fabricated data out of the bank's own data is lib/demo/provider.ts being
 * the only door to lib/demo and the `origin` provenance column on capture
 * tables -- see lib/demo/mode.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { DEMO_MODE_COOKIE } from "@/lib/demo/mode";
import { isDemoBuild } from "@/lib/demo/provider";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  const { isDemoMode } = await import("@/lib/demo/mode");
  const demoMode = await isDemoMode();
  return NextResponse.json({ demoMode });
}

export async function POST(request: NextRequest) {
  if (!isDemoBuild()) {
    return NextResponse.json(
      {
        error:
          "Demo mode is not available on this deployment. " +
          "Set JANA_DEMO=1 in the deployment environment to enable the demo switch.",
      },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const { on } = (body ?? {}) as { on?: boolean };
  if (typeof on !== "boolean") {
    return NextResponse.json(
      { error: "Body must be { on: boolean }." },
      { status: 400 },
    );
  }

  const res = NextResponse.json({ ok: true, demoMode: on });
  res.cookies.set(DEMO_MODE_COOKIE, on ? "on" : "off", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    // Session-scoped on purpose. Demo mode should not silently persist for
    // weeks after a demo; closing the browser returns the build to its
    // default, which is off (production).
  });
  return res;
}
