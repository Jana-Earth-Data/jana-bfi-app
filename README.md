# Jana BFI Demo

Sales-demo dashboard for Jana Earth Data's financed-emissions product, scoped to Nepal's commercial banking sector. Shows a loan officer's and a manager's view of a fictional bank's portfolio against the five regulatory frameworks that shape bank sustainability compliance, with PCAF Cat. 15 attribution math wired to real Climate TRACE 2024 and EDGAR data.

| Framework | Module | Purpose |
|---|---|---|
| NRB ESRM Guideline 2022 | ESDD | Environmental & Social Due Diligence checklists (Annex 5) |
| NRB Green Finance Taxonomy 2024 | Taxonomy | Loan classification (green / amber / red) |
| PCAF Global Standard | PCAF | Financed-emissions data quality scoring |
| IFC Performance Standards | PF Screening | Project Finance safeguard screening (Annex 5b) |
| NRB ESRM Annex 8–10 | CAP / Monitoring | Corrective Action Plans and periodic monitoring |

NFRS S1/S2 (Accounting Standards Board Nepal, April 2026 exposure drafts; comment period closed 6 June 2026, mandatory date TBD) drives the disclosure tab.

The dashboard has five top-level tabs — **My Work** (the signed-in officer's review queue), **Loan Book**, **Manager**, **Taxonomy** and **NFRS**. The Manager tab is a workbench with its own sub-tabs: Overview, CAP + Covenants, PCAF, plus Hydropower docs and Facility map where the selected loan has them. See `docs/ARCHITECTURE.md` for the full picture.

The app ships **two modes in a single build** — demo (fabricated 80K-loan portfolio) and live (empty loan book, real officer captures). The `JANA_DEMO` build flag gates the separation; see Environment variables below.

## Stack

- Next.js 15 / React 19 / TypeScript
- Tailwind CSS (custom dark theme)
- Recharts, Leaflet (dynamic-imported), OpenAI TTS (audio narration)
- Synthesized 80K-loan portfolio rooted in real Nepal entities (61 cement plants from GCCT, real CT 2024 facility emissions, polygon-clipped EDGAR national CO₂)

## Quick start

```bash
cp .env.local.example .env.local
npm install
npm run dev:demo     # demo build (JANA_DEMO=1) — what a sales demo runs
# npm run dev        # live build — empty loan book, no fabricated portfolio
# → http://localhost:3000
```

## Environment variables

`JANA_DEMO` is a **build-time flag, not a runtime setting**, and it gates the
whole demo/live separation — the 80K-loan portfolio, the invented officers, the
Demo menu, and the `/api/demo/*` routes all exist only when it is set. Set it
via the npm scripts (`build:demo` / `dev:demo`), the Dockerfile build arg, or
`vercel.json`. Do not put it in `.env.local`.

| Variable | Purpose |
|---|---|
| `JANA_DEMO` | Build-time. `1` → demo build; unset → live build. Set by `npm run build:demo` / `dev:demo`, the `JANA_DEMO` Dockerfile ARG, and `vercel.json` |
| `NEXT_PUBLIC_API_URL` | Jana API base URL (default `https://api-test.jana.earth`) |
| `NEXT_PUBLIC_AUTH_URL` | Jana auth service for the device-code flow (default `https://auth-dev.jana.earth`) |
| `NEXT_PUBLIC_DEMO_USE_MOCKS` | `true` forces mock mode; `false` enables the live overlay after sign-in |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL for officer-capture persistence |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key — public, used on read paths |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-side only.** Bypasses RLS; never expose to the browser |
| `SEED_ADMIN_TOKEN` | Shared secret guarding `/api/admin/seed*` and `/api/admin/reset` (`?token=`) |

See `.env.local.example` for the annotated version, including what the offline
Docker compose supplies for you.

`tts.key` is a separate local-only file holding the OpenAI API key used by `scripts/generate-tour-audio.py` to (re)generate the guided-tour MP3s. It's gitignored and must not be committed.

## Deploy to Vercel

The committed `vercel.json` carries the build config, so most settings need no
manual entry.

1. Push the repo to GitHub (or your preferred git host).
2. In the Vercel dashboard, **Import Project** → select the repo.
3. Add the Supabase variables and `SEED_ADMIN_TOKEN` under **Settings → Environment Variables**. `JANA_DEMO` is already set in `vercel.json`.
4. Click **Deploy**. First build takes ~2 minutes; subsequent builds are incremental.

The committed `vercel.json` pins the build region to `bom1` (Mumbai — same region as the Supabase project), sets `JANA_DEMO=1`, runs `npm run build:demo` as the build command (so the `prebuild` hook that precomputes the 80K-loan portfolio actually fires — calling `next build` directly skips it and costs ~50s on every cold start), and disables silent-deploy commit comments. `.vercelignore` keeps raw data CSVs/GeoJSON, the Docker artifacts, and `docs/` out of the build artifact — the `data/*.json` snapshots, the audio MP3s, and the app code ship. **`scripts/` is deliberately not excluded**: the `prebuild` hook runs its guards and the precompute step from there, and some guards read `.sql` files at build time, so excluding any of it breaks the Vercel build.

## Deploy via Docker (alternative)

```bash
docker compose up --build
# → http://localhost:3001
```

The included `Dockerfile` does a multi-stage build with Next.js standalone output and ships a minimal `node:20-alpine` runner. Used by the ECR/ECS path in `.github/workflows/`.

## Regenerating data snapshots

If GCCT, Climate TRACE, EDGAR, or the curated industrial list changes:

```bash
python3 scripts/build-data-snapshots.py
```

This rebuilds `data/{cement-plants,hydropower-operators,industrial-entities,ct-nepal-2024,edgar-nepal-2024}-npl.json` from the raw CSVs/GeoJSON staged in `data/_raw_*` and the GCCT xlsx in `~/Downloads/`.

## Regenerating tour audio

```bash
python3 scripts/generate-tour-audio.py            # incremental (skips existing)
python3 scripts/generate-tour-audio.py --force    # full regen
python3 scripts/generate-tour-audio.py --step closing --force   # one step
```

Requires `tts.key` (OpenAI API key) in the repo root. Output → `public/audio/tour-*.mp3`.
