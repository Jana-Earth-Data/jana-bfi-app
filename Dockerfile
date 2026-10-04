FROM node:20-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=https://api-test.jana.earth
ARG NEXT_PUBLIC_AUTH_URL=https://auth-dev.jana.earth
ARG NEXT_PUBLIC_DEMO_USE_MOCKS=true

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_AUTH_URL=$NEXT_PUBLIC_AUTH_URL
ENV NEXT_PUBLIC_DEMO_USE_MOCKS=$NEXT_PUBLIC_DEMO_USE_MOCKS
ENV NEXT_OUTPUT=standalone

# P5.8: One build that always includes the demo capability.
# The precomputed portfolio is generated unconditionally by prebuild guards.
# JANA_DEMO is now runtime-only (see runner stage below).

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

# P5.8: JANA_DEMO is runtime-only. The build always generates the precomputed
# portfolio (via prebuild guards), so there is no build-time flag anymore.
#
# This ENV controls whether the demo switch is offered to users:
# - isDemoBuild() reads process.env.JANA_DEMO in the running server
# - Gates the Demo menu and the /api/demo/mode toggle route
# - Enables the provider's dynamic import of demo data
#
# Without this ENV the demo switch would be unavailable even though the image
# was built with the precomputed portfolio, and the failure would be silent:
# no Demo menu and an empty loan book, with no error anywhere saying why.
ENV JANA_DEMO=1

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
#
# Use 127.0.0.1, NOT localhost. The Next.js standalone server binds IPv4
# 0.0.0.0 only; busybox wget resolves "localhost" to IPv6 ::1 first, which
# has no listener, so the probe fails with "Connection refused" even though
# the app serves fine on every external interface. Pinning IPv4 makes the
# probe hit the socket the server is actually on.
#
# start-period is 30s (was 10s): a cold standalone boot plus the first
# force-dynamic render can exceed 10s, and probes during start-period that
# fail were still counting toward the unhealthy threshold on this image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
