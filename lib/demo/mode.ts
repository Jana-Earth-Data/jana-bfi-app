/**
 * Demo mode — is the demo layer switched ON right now?
 *
 * Distinct from isDemoBuild() in ./provider.ts, and the difference matters.
 *
 *   isDemoBuild()  — is the demo switch AVAILABLE on this deployment? Read
 *                    from process.env.JANA_DEMO at runtime, despite the name.
 *                    (Correction 2026-09-30: earlier comments called this
 *                    build-time and said a "live build" contains no demo
 *                    code; the demo code is in every bundle -- see
 *                    lib/demo/provider.ts.)
 *   isDemoMode()   — is demo mode ON for this user's request? Runtime,
 *                    per-user, togglable.
 *
 * With the switch available, the toggle lets a user move between the demo
 * portfolio and the bank's own data without a redeploy.
 *
 * The rule
 * --------
 *   effective = isDemoBuild() && cookie === "on"
 *
 * Demo mode is per user: the switch is a session cookie in that user's
 * browser, and every capture read or write is scoped to the request's origin
 * (lib/data/capture-client.ts), so one person switching demo on never changes
 * what anyone else sees.
 *
 * Default OFF (changed 2026-09-30). The production system is what everyone
 * gets; demo mode is opt-in -- for training new users, or a sales walkthrough
 * -- via the demo menu. Previously an absent cookie meant ON, so every new
 * session on the deployed app opened on fabricated data.
 *
 * The switch is a convenience, not a security boundary. What keeps
 * fabricated rows out of the bank's data is the provenance (origin) column
 * and lib/demo/provider.ts being the only door to the demo layer.
 */

import { cookies } from "next/headers";
import { isDemoBuild } from "./provider";

export const DEMO_MODE_COOKIE = "jana_demo_mode";

/**
 * Whether the demo layer is active for this request.
 *
 * Server-only: reads the cookie jar. Client components receive the resolved
 * value as a prop rather than re-deriving it, so there is one answer per
 * render and no chance of the banner and the data disagreeing.
 */
export async function isDemoMode(): Promise<boolean> {
  if (!isDemoBuild()) return false;
  const jar = await cookies();
  const raw = jar.get(DEMO_MODE_COOKIE)?.value;
  // Absent means off: production by default, demo only when chosen.
  return raw === "on";
}

/**
 * Whether to render the demo controls at all.
 *
 * True whenever the demo switch is available on this deployment, including
 * when demo mode is toggled off -- the menu is how you toggle it back on.
 * Where the switch is not available (JANA_DEMO unset) this returns false and
 * the controls are never rendered.
 */
export function showDemoControls(): boolean {
  return isDemoBuild();
}
