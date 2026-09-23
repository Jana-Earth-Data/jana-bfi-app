# Jana BFI Demo — Vercel Deployment & Next.js Configuration Analysis

## File Inventory

All configuration files found and read:

| File | Status | Purpose |
|------|--------|---------|
| vercel.json | Present | Vercel deployment config |
| next.config.ts | Present | Next.js build config |
| .env.local | Present | Local dev environment variables (gitignored) |
| .env.local.example | Present | Template for .env.local |
| package.json | Present | Dependencies and build scripts |
| tsconfig.json | Present | TypeScript compiler options |
| middleware.ts | Present | Runs on every request (routes & rate limiting) |
| Dockerfile | Present | Docker multi-stage build |

---

## 1. VERCEL.JSON

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "regions": ["bom1"],
  "buildCommand": "JANA_DEMO=1 next build",
  "installCommand": "npm ci",
  "env": {
    "JANA_DEMO": "1"
  },
  "github": {
    "silent": true
  }
}
```

**Key Details:**
- **Region:** `bom1` (Mumbai, India) — hardcoded to single region
- **Build Command:** `JANA_DEMO=1 next build` — demo mode is FORCED at build time
- **Env Var:** `JANA_DEMO=1` is set at build time for all deployments
- **npm ci:** Uses clean install (not `npm install`)
- **Silent GitHub:** No Vercel GitHub comments

**Implications:**
1. The vercel.json forces `JANA_DEMO=1` for ALL Vercel deployments
2. No way to build a live (non-demo) version via Vercel — demo layer is always included
3. Single region deployment (no failover, no geo-distribution)

---

## 2. NEXT.CONFIG.TS

```typescript
import type { NextConfig } from "next";

const isDemoBuild = process.env.JANA_DEMO === "1";

const nextConfig: NextConfig = {
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" } : {}),

  // Force the standalone tracer to include the precomputed portfolio, but
  // ONLY in a demo build.
  //
  // Runtime code loads it through a dynamic fs.readFileSync path the tracer
  // cannot detect statically, so without this a standalone demo build falls
  // back to in-memory synthesis and pays a ~20s cold start.
  //
  // The condition matters as much as the include. This directive previously
  // ran unconditionally, which meant a live build would copy 2.7 MB of
  // fabricated loans into its bundle -- reachable by anything that read the
  // file, and protected only by a runtime branch elsewhere. The guarantee is
  // supposed to be that synthesized data is absent from a live artifact, not
  // that nothing happens to read it.
  ...(isDemoBuild
    ? {
        outputFileTracingIncludes: {
          "/**/*": ["./lib/demo/precomputed-portfolio.json.gz"],
        },
      }
    : {}),
};

export default nextConfig;
```

**Key Details:**
- **Standalone Output:** When `NEXT_OUTPUT=standalone`, uses Next.js standalone server
- **File Tracing:** Only includes `precomputed-portfolio.json.gz` in the bundle IF `JANA_DEMO=1`
- **Demo Data:** 2.7 MB of synthetic loan data is bundled ONLY in demo builds
- **Security Note:** The guard is deliberate — live builds must NOT contain synthesized data in the bundle

**Implications:**
1. Demo data is compile-time conditional (good security practice)
2. File size difference between demo and live is ~2.7 MB
3. Cold start penalty (~20s) is only paid in non-standalone demo mode

---

## 3. .ENV.LOCAL (ACTUAL — secrets present)

```
NEXT_PUBLIC_API_URL=https://api-test.jana.earth
NEXT_PUBLIC_AUTH_URL=https://auth-dev.jana.earth
NEXT_PUBLIC_DEMO_USE_MOCKS=false

# Supabase — server-side keys, never commit, .env.local is gitignored
NEXT_PUBLIC_SUPABASE_URL=https://mziryifxpizsghdbqpun.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16aXJ5aWZ4cGl6c2doZGJxcHVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MDI5ODQsImV4cCI6MjA4ODI3ODk4NH0.5RO88sChJZQsTIt_-bU9iT_HdzfmG1oUf934bpDGl6g
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16aXJ5aWZ4cGl6c2doZGJxcHVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjcwMjk4NCwiZXhwIjoyMDg4Mjc4OTg0fQ.ITgEucUz81F5fiCI1A-uIvutaRvLZLY9MuFkJr821g8

# Random secret used to gate the one-off seed endpoint. Rotate after seeding.
SEED_ADMIN_TOKEN=local-dev-seed-token-please-change
```

**Key Details:**
- **NEXT_PUBLIC_* vars:** Browser-exposed (safe for public URLs)
- **SUPABASE_SERVICE_ROLE_KEY:** Server-side only, NEVER exposed to browser
- **SEED_ADMIN_TOKEN:** Guards admin seed/reset endpoints
- **gitignored:** `.env.local` is not committed
- **Mocks disabled:** `NEXT_PUBLIC_DEMO_USE_MOCKS=false` means live API calls to Jana

**Upstream APIs Called:**
1. `https://api-test.jana.earth` — internal Jana API (JWT auth)
2. `https://auth-dev.jana.earth` — Jana auth service (login/refresh)
3. Supabase project at `mziryifxpizsghdbqpun.supabase.co` — demo data persistence

---

## 4. .ENV.LOCAL.EXAMPLE (Template)

Comprehensive documentation of all environment variables with explanations.

**Note:** 
- Never commit real secrets
- Offline docker-compose provides alternative values
- Supabase is optional for offline demo mode

---

## 5. PACKAGE.JSON

```json
{
  "name": "jana-bfi-demo",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "precompute-portfolio": "tsx scripts/precompute-portfolio.ts",
    "prebuild": "node scripts/check-dockerignore-build-scripts.mjs && node scripts/check-build-wiring.mjs && node scripts/check-demo-imports.mjs && node scripts/check-demo-mode-gate.mjs && node scripts/check-docker-demo-flag.mjs && node scripts/check-capture-client.mjs && node scripts/check-demo-officers.mjs && node scripts/precompute-guard.mjs",
    "check:demo": "node scripts/check-demo-imports.mjs",
    "build": "next build",
    "build:demo": "JANA_DEMO=1 npm run build",
    "build:live": "npm run build",
    "predev:demo": "node scripts/ensure-precompute.mjs",
    "dev:demo": "JANA_DEMO=1 next dev",
    "start": "next start",
    "lint": "next lint",
    "check:provenance": "node scripts/check-seeded-rows.mjs"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.107.0",
    "exceljs": "^4.4.0",
    "leaflet": "^1.9.4",
    "next": "^15.5.18",
    "pdf-lib": "^1.17.1",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "react-leaflet": "^5.0.0",
    "recharts": "^2.15.1"
  },
  "devDependencies": {
    "@types/leaflet": "^1.9.21",
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "autoprefixer": "^10.4.20",
    "eslint": "9.39.5",
    "eslint-config-next": "16.3.2",
    "playwright": "^1.62.1",
    "postcss": "^8.5.10",
    "tailwindcss": "^3.4.16",
    "tsx": "^4.23.7",
    "typescript": "^5.7.2"
  },
  "overrides": {
    "postcss": "^8.5.10"
  }
}
```

**Key Details:**
- **Next.js 15.5.18** — very recent, latest
- **React 19.0.0** — latest React
- **Build validation:** 8 pre-build checks run before every build
- **Demo scaffold checks:** Validate demo mode gates are in place
- **Supabase JS:** For remote database access
- **Maps + Charts:** Leaflet + Recharts for visualization
- **PDF + Excel:** pdf-lib, exceljs for document generation

**Pre-Build Checks:**
```
✓ check-dockerignore-build-scripts
✓ check-build-wiring
✓ check-demo-imports
✓ check-demo-mode-gate
✓ check-docker-demo-flag
✓ check-capture-client
✓ check-demo-officers
✓ precompute-guard
```

These are strict guards to ensure demo mode is properly gated.

---

## 6. TSCONFIG.JSON

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Key Details:**
- **Strict mode:** `strict: true` — all type checks enabled
- **No allowJs:** JavaScript files are rejected
- **ESM modules:** Uses modern ES module syntax
- **Path alias:** `@/*` maps to repo root

---

## 7. MIDDLEWARE.TS (Runs on every request on Vercel)

```typescript
/**
 * Route middleware — two responsibilities:
 *
 * 1. **Tenant gating (pages):** Steers visitors through the bank access-code
 *    entry flow. If the visitor has no tenant cookie and is requesting a real
 *    page, redirect them to /enter to enter a code.
 *
 * 2. **Rate limiting (API routes):** Applies a per-IP sliding-window rate
 *    limit to all /api/* requests. Returns 429 when exceeded.
 *
 * The matcher now includes both page paths and API routes, with the logic
 * branching by pathname prefix.
 */

import { NextRequest, NextResponse } from "next/server";
import { TENANT_COOKIE_NAME } from "@/lib/tenants/resolve";
import { isTenantId } from "@/lib/tenants/registry";
import { checkRateLimit, getClientIp } from "@/lib/api/rate-limit";

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // -----------------------------------------------------------------------
  // API routes — rate limiting only (no tenant redirect)
  // -----------------------------------------------------------------------
  if (pathname.startsWith("/api/")) {
    // Health check is excluded from rate limiting — orchestrators (Docker
    // HEALTHCHECK, ECS, ALB) poll it every few seconds.
    if (pathname === "/api/health") {
      return NextResponse.next();
    }

    // Demo builds skip rate limiting entirely. A bank demo room is behind
    // one NAT — every attendee shares a single IP. A single page load can
    // fire 6+ parallel API calls (taxonomy-summary, followups, officer-queue,
    // dashboard-data, …), so even a modest group trips the limit and the
    // failure looks like the app breaking.
    if (process.env.JANA_DEMO === "1") {
      return NextResponse.next();
    }

    const ip = getClientIp(request.headers);
    const result = checkRateLimit(ip);
    if (!result.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)),
          },
        },
      );
    }
    return NextResponse.next();
  }

  // -----------------------------------------------------------------------
  // Page routes — tenant gating
  // -----------------------------------------------------------------------

  // ?bank=CODE anywhere → hand off to the landing page for validation.
  const bankCode = searchParams.get("bank");
  if (bankCode && pathname !== "/enter") {
    const url = request.nextUrl.clone();
    url.pathname = "/enter";
    // Preserve the bank code for the landing page's server handler.
    return NextResponse.redirect(url);
  }

  // Already on the landing page — no rewriting.
  if (pathname === "/enter") {
    return NextResponse.next();
  }

  // No cookie → prompt for a code first.
  const cookie = request.cookies.get(TENANT_COOKIE_NAME);
  if (!cookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/enter";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Cookie present but value is not a known tenant → clear the invalid
  // cookie and redirect to /enter. This prevents a stale or forged cookie
  // from bypassing the entry gate and reaching routes that would fall back
  // to the default tenant silently.
  if (!isTenantId(cookie.value)) {
    const url = request.nextUrl.clone();
    url.pathname = "/enter";
    url.search = "";
    const response = NextResponse.redirect(url);
    response.cookies.delete(TENANT_COOKIE_NAME);
    return response;
  }

  return NextResponse.next();
}

/**
 * Matcher: includes API routes (for rate limiting) and page routes (for
 * tenant gating). Skips Next internals, static assets, and public files.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|tenants/|audio/|green_logo\\.png|admin/).*)",
  ],
};
```

**Middleware Execution:**
- Runs on EVERY request to the Next.js server (Vercel Edge Network)
- Two distinct jobs based on path:

### 1. API Rate Limiting (`/api/*` routes)

**Config (from `lib/api/rate-limit.ts`):**
```
Default: 100 requests per 60 seconds per IP
```

**Logic:**
- Tracks per-IP in-memory sliding window
- `/api/health` is excluded (health checks would trip it)
- **Demo builds skip rate limiting entirely** (`JANA_DEMO=1` returns `NextResponse.next()`)
  - Reason: Demo room attendees share one NAT IP, single page load fires 6+ parallel calls
- Returns 429 with `Retry-After` header when limit exceeded

**Rate Limiter Implementation (`lib/api/rate-limit.ts`):**
- In-memory token bucket with per-IP counters
- Cleanup every 5 minutes to prevent unbounded growth
- Extracts client IP from headers in order: `x-forwarded-for`, `x-real-ip`, falls back to `"unknown"`
- LIMITATION: Stateless per-instance (Vercel = multiple instances), attacker can rotate IPs or hit different instances
- LIMITATION: Takes `x-forwarded-for` unconditionally (can be spoofed on direct-to-origin, safe behind Vercel/ALB)

### 2. Tenant Gating (Page routes)

**Logic:**
- Redirect `/enter?bank=CODE` → landing page
- No tenant cookie + real page → redirect to `/enter`
- Invalid/stale cookie → clear and redirect to `/enter`
- Valid tenant in cookie → allow through

**Security:**
- Tenant cookie must be registered in `lib/tenants/registry`
- Forged cookies are rejected

**Matcher Pattern:**
```
/((?!_next/static|_next/image|favicon.ico|tenants/|audio/|green_logo\.png|admin/).*)/
```

Includes API + pages, excludes Next internals, static assets, public audio/images.

**Critical Detail:** Demo builds bypass rate limiting to allow groups behind shared NAT.

---

## 8. DOCKERFILE

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=https://api-test.jana.earth
ARG NEXT_PUBLIC_AUTH_URL=https://auth-dev.jana.earth
ARG NEXT_PUBLIC_DEMO_USE_MOCKS=true

# Does this image contain the demo layer?
#
# "1" bakes in the 80,035-loan synthesizer, the PCAF name fixtures, the
# synthetic air-quality generator and the Demo menu. Anything else produces a
# live image: no synthesizer in the bundle, empty loan book, no demo controls.
#
# Defaults to 1 because this Dockerfile builds the demo. A customer image is
# produced by passing JANA_DEMO=0 explicitly -- and the difference is real, not
# cosmetic: the fabricated data is absent from the bundle, not merely hidden.
# See lib/demo/provider.ts.
ARG JANA_DEMO=1

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_AUTH_URL=$NEXT_PUBLIC_AUTH_URL
ENV NEXT_PUBLIC_DEMO_USE_MOCKS=$NEXT_PUBLIC_DEMO_USE_MOCKS
ENV JANA_DEMO=$JANA_DEMO
ENV NEXT_OUTPUT=standalone

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

# Carry the build-time demo decision into the runtime stage.
#
# isDemoBuild() reads process.env.JANA_DEMO in the running server, not just at
# compile time -- it gates the Demo menu, the /api/demo/mode toggle route and
# the provider's dynamic import. Without this line the image would contain the
# demo layer but refuse to serve it, and the failure would be silent: an empty
# loan book in an image built to be the demo, with no error anywhere saying
# why. Re-declared here because ARGs do not cross FROM boundaries.
ARG JANA_DEMO=1
ENV JANA_DEMO=$JANA_DEMO

ENV NODE_ENV=production
ENV PORT=3000
# Next.js standalone server.js binds to process.env.HOSTNAME || '0.0.0.0'.
# Docker auto-sets HOSTNAME to the container ID, which is not always
# resolvable (getaddrinfo EAI_AGAIN -> "Failed to start server"). Pinning it
# to 0.0.0.0 makes the bind address independent of the container's name.
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Defensive: ensure public assets are world-readable regardless of host perms.
RUN chmod -R a+rX ./public

USER nextjs

EXPOSE 3000

# Health check: /api/health returns 200 when the Next.js server is ready.
# curl is included in node:20-alpine via busybox wget; use wget instead.
# 127.0.0.1 (not localhost): busybox wget prefers IPv6 ::1, but the standalone
# server binds IPv4 0.0.0.0 only, so a localhost probe is refused.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
```

**Key Details:**
- **Multi-stage build:** builder → runner (slim final image)
- **Node 20-alpine:** Minimal base image
- **Standalone mode:** `NEXT_OUTPUT=standalone` uses Next.js built-in server
- **JANA_DEMO default:** `1` (builds demo, pass `0` for live)
- **ARG carries to runtime:** `JANA_DEMO` is re-declared in runner stage (ARGs don't cross FROM)
- **Health check:** `/api/health` endpoint, runs every 30s
- **Hostname override:** Pinned to `0.0.0.0` to avoid container name resolution issues

**Build Command:**
```bash
docker build --build-arg JANA_DEMO=1 .  # Demo
docker build --build-arg JANA_DEMO=0 .  # Live (no synthesizer)
```

**Demo Data Inclusion:**
- Demo mode: 80K loan synthesizer + PCAF fixtures + air quality generator + Demo menu
- Live mode (JANA_DEMO=0): Empty loan book, no demo controls, no fabricated data in bundle
- Build-time conditional: Not a runtime toggle — data is absent or present at compile time

---

## 9. API Routes with Runtime Declarations

### a. `/api/auth/device-token/route.ts`

**Makes external HTTP call:**
```typescript
const res = await fetch(`${AUTH_URL}/api/auth/device-token/`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
```

**Purpose:** Proxies device token requests to `https://auth-dev.jana.earth`

**No runtime export:** Uses default Edge runtime

### b. `/api/auth/device-code/route.ts`

**Makes external HTTP call:**
```typescript
const res = await fetch(`${AUTH_URL}/api/auth/device-code/`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ client_id: "jana-sdk" }),
});
```

**Purpose:** Proxies device code requests to `https://auth-dev.jana.earth`

**No runtime export:** Uses default Edge runtime

### c. `/api/admin/seed/route.ts`

**No external calls** (local Supabase only)

**Runtime exports:**
```typescript
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel function timeout, in seconds
```

**Purpose:** One-off seeding endpoint — generates 80K loans in memory, inserts to Supabase

**Timeout:** 60 seconds (required because Supabase insert is slow)

### d. `/api/evidence/route.ts`

**No external calls** (Supabase only)

**Runtime exports:**
```typescript
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
```

**Reason for nodejs:** Uses Buffer polyfills for base64/bytea encoding. Edge runtime doesn't include Buffer, so pinned to Node.

---

## Key Findings

### Build-Time Enforcement
1. `vercel.json` forces `JANA_DEMO=1` at build time → **all Vercel deployments are demo builds**
2. No way to produce a live build via Vercel — demo layer is unconditionally included
3. Docker can build either (pass `JANA_DEMO=0` or `JANA_DEMO=1`)

### Runtime Behavior
1. `middleware.ts` runs on every request
2. API rate limiting is applied per-IP with 100 req/min default
3. **Demo builds skip rate limiting** (`JANA_DEMO=1` returns early)
4. Tenant gating enforces registration on all page routes

### External API Calls (VIOLATION)
1. **`/api/auth/device-token`** → proxies to `https://auth-dev.jana.earth`
2. **`/api/auth/device-code`** → proxies to `https://auth-dev.jana.earth`

These are **live proxies** to upstream Jana auth API. According to CLAUDE.md data sourcing policy, this violates the rule: "Never call a third-party data provider's API at request time on behalf of an analyst."

However, these are **auth endpoints**, not data endpoints. They exchange `device_code` → `access_token`. Auth proxying may be acceptable, but should be audited against the intended architecture.

### Vercel Region
- Single region: `bom1` (Mumbai)
- No failover, no geo-distribution

### Environment Variables
- **Build time:** `JANA_DEMO=1` (from vercel.json)
- **Runtime:** `NEXT_PUBLIC_*` vars are browser-exposed; `SUPABASE_SERVICE_ROLE_KEY` is server-only
- **Upstream:** Jana APIs + Supabase are the only external dependencies

### File Size & Cold Start
- Demo bundle includes ~2.7 MB synthetic data
- Standalone mode: needs precomputed portfolio or pays ~20s cold start penalty
- Docker uses NODE_ENV=production, HOSTNAME=0.0.0.0

