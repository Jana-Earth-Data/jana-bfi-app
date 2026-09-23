# User Manual v0.3 — build notes

**Built:** 15 September 2026
**Builder:** `docs/build_manual_v03.js` (derived from the v0.2 builder; run `node docs/build_manual_v03.js <out.docx>`)
**Artifacts:** `Jana_Financed_Emissions_Dashboard_User_Manual_Demo_v0.3.docx` / `.pdf` (31 pages)
**Supersedes:** v0.2 (docx/PDF shipped 26 Aug 2026) — retained for the record; do not circulate.

## Why v0.3 exists

v0.2 was built on 3 August 2026 and shipped on 26 August. P44 to P46 and the demo/live
separation work landed after the content was written, leaving four factual errors and six
undocumented features in a customer-facing document.

## Corrections

| Area | v0.2 said | v0.3 says | Source of truth |
|---|---|---|---|
| ESDD question count | "a sector-agnostic checklist of twelve questions" (body + glossary) | thirteen: 4 general (1.1–1.4), 5 EHS (2.1–2.5), 4 social (3.1–3.4) | `lib/regulatory/esdd/annex5-questions.ts`; count derived via `fullChecklist().length` |
| Q1.4 | absent | named (land acquisition with resettlement), flagged as a 2022-edition addition alongside Q2.5 | `annex5-questions.ts:212` |
| Escalation rule | any "c" triggers credit-committee escalation; two "c" in Section 3 escalate further | `escalationFlag = riskClass !== "low"` per §7.3.6 — a "b" escalates too; the two-"c" rule is gone | P46 |
| Escalation destination | "credit committee" | "next-higher credit approval authority" | P46 |
| Annex 5b red lines | "IFC PS termination-grade triggers" presented as NRB content | twelve red-line flags, labelled explicitly as Jana's synthesis of the IFC PS text, with the note that NRB publishes no escalation grid for Annex 5b | `lib/regulatory/esdd/annex5b-pf-scoring.ts` |
| Citation | "Circular 22" used 32 times as the operative source | "NRB ESRM Guideline (Second Edition, February 2022)". Circular 22 now appears three times only, correctly: as the 2018 mandate, as the edition that lacks Q1.4/Q2.5, and in the glossary | P46 convention |

## Features documented for the first time

- **1.5 Demonstration mode and live mode** — build-time `JANA_DEMO` flag, DEMO MODE banner, Demo menu, and the provenance column that keeps demonstration rows out of live reports and regulatory exports.
- **5.7 Loan category override** — the override now persists against the loan (P45).
- **8.2** — the availability panel records the answer (Exists / Does not exist) separately from its source (AUTO / MANUAL); previously a bare toggle could not distinguish "checked, answer is no" from "nobody has looked".
- **8.3 What each flag may rest on** — the PCAF evidence document matrix (`lib/regulatory/pcaf/evidence-matrix.ts`) and which flags may pre-fill automatically.
- **Part 9** — the `/cap/[loanId]` full-page route (P44), consistent with the other four wizards.

## Verified after build

Checked against the generated PDF: "thirteen questions" present; zero occurrences of the stale
escalation language, "termination-grade", or "NRB Circular 22". The three remaining instances of
"twelve" all refer to the twelve IFC red-line flags, which is correct.

## Second pass (15 September 2026)

A check for stale screenshots found that **the manual contains no screenshots** — it never has.
The v0.2 and v0.3 builders contain no `ImageRun` and the v0.2 docx has no media parts. An earlier
note in this file claiming screenshots were inherited from v0.2 was wrong and has been removed.
The single image in the v0.2 PDF was the cover logo, not a screen capture.

That check did surface four real defects, all now fixed:

| Defect | Detail | Fix |
|---|---|---|
| Cover logo lost | The v0.2 PDF carried the Jana logo on the title page. The builder never placed it — it was added by a separate branding step — so the first v0.3 build came out unbranded. | `ImageRun` added to the cover block, resolving `public/green_logo.png` through a candidate-path list so the build works from `docs/` or a scratch directory. |
| Date wrong | Running header and footer were hardcoded to **November 2026**, a future date. Inherited from the v0.2 builder; the shipped v0.2 PDF said August, so that artifact was not produced by this script unmodified. | Both occurrences set to September 2026. |
| CTA undefined | "CTA" first appeared as a section heading with no expansion. | Heading is now "Call-to-action buttons on the loan card"; first body use expands it; glossary entry added. |
| EV ambiguous | "EV" was used for enterprise value in the PCAF sections and for electric vehicles in the taxonomy activity list. | Taxonomy list spells out electric vehicles; glossary entry states EV always means enterprise value. EIA / IEE also added to the glossary. |

A block-level diff of the v0.2 docx against v0.3 confirmed no content was lost in the rebuild:
all 43 blocks present in v0.2 and absent from v0.3 are the intended corrections.

## Figures

Fourteen figures, captured 16 September 2026 from the **default tenant** (First Bank of Nepal) at
1600x1000 @2x and embedded automatically. The pipeline:

- `scripts/capture-screenshots.ts` gained a `--profile manual` mode. It captures fourteen
  element-scoped shots from the **default tenant** (First Bank of Nepal), not the Laxmi tenant the
  proposal set uses, so the manual is not branded for one bank when handed to another. Output goes
  to `docs/manual-screenshots/`, leaving `docs/proposal-screenshots/` untouched.
- `docs/build_manual_v03.js` embeds each figure if the PNG is present and skips it silently if not,
  so a text-only rebuild never fails for want of a browser. Figures are numbered automatically and
  captioned; the build prints how many were embedded and names any that were missing.
- `package.json` gained `capture:manual`, `capture:proposal`, and `manual:build`, and pins `docx`
  as a dev dependency (the builder needed it but nothing declared it).

Four captures came back far taller than they were wide — the Annex 5b wizard is 148 items, so it
photographed at 3200x22298, an aspect ratio of 1:7 that renders as an unreadable sliver on the page.
Those four (04, 10, 11, 12) are cropped to a 1:1.6 aspect keeping the informative top; the uncropped
originals are kept alongside as `*-full.png`. Set `maxAspect` on those shots in the capture script if
you would rather the clipping happened at capture time.

The app is dark-only by design (`:root { color-scheme: dark }` in `app/globals.css`), so the figures
are dark. That is faithful to the product, but fourteen dark screenshots are heavy on ink — worth
knowing before anyone prints the manual rather than reading the PDF.

To reproduce them:

```
docker compose up -d --build
curl -X POST "http://localhost:3001/api/admin/seed-officers?token=$SEED_ADMIN_TOKEN"
curl -X POST "http://localhost:3001/api/admin/seed?token=$SEED_ADMIN_TOKEN"
curl -X POST "http://localhost:3001/api/admin/seed-demo-data?token=$SEED_ADMIN_TOKEN"
npm install && npx playwright install chromium
npm run capture:manual
npm run manual:build
```

If the default tenant seeds different loan ids than the Laxmi tenant, pass
`--cement-loan L-xxxxxxx --hydro-loan L-xxxxxxx`. This could not be verified here: the sandbox has
no Docker and Playwright's Chromium download is blocked, so the fourteen shots have not been run
even once. Expect one or two selector or loan-id corrections on the first attempt.

## Contents page

v0.1 and v0.2 both shipped a **blank Contents page**. The builder emitted a Word `TableOfContents`
field, which only populates when a word processor updates fields; converting the .docx straight to
PDF left it empty and nobody noticed across two releases.

v0.3 emits a static list instead, with real page numbers injected by a two-pass build:
`docs/build_manual.sh` builds once, reads the actual page of each Part heading out of the PDF, then
rebuilds with the numbers baked in and repeats if pagination shifted. Use that script rather than
calling the builder directly. Page numbers are right-aligned on a real tab stop, not a
`PositionalTab` — ptab is a Word-only element that LibreOffice silently drops, which jammed the
number against the title on the first attempt.

## Known gaps

- Page count moved 33 (v0.2) to 32 (v0.3). The conversion path here is LibreOffice; whatever
  produced the v0.2 PDF was different. Worth a visual pass before the manual is circulated.
- Residual "Circular 22" citations remain in code comments across roughly a dozen source files.
  Some are legitimate Excel cell references; several are operative citations. Documentation-only
  scope, so not touched — see the note at the end of this file's companion audit.
