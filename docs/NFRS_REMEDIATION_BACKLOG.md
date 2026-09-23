# NFRS S1 / S2 Remediation Backlog

**Date:** 19 September 2026
**Source:** `docs/NFRS_S1_S2_GAP_ANALYSIS.md`
**Relationship to `PROJECT_PLAN.md`:** that document remains the single source of truth for project
status. This backlog is a **feed into it** — and as of **19 Sep 2026 these tiers have been scheduled**
into PROJECT_PLAN as dedicated **Production-Regulatory (PR) phases**. Track status there, not here:

| Backlog tier | PROJECT_PLAN phase | PROJECT_PLAN section |
|--------------|--------------------|----------------------|
| N0 (integrity blockers) | **PR0** — Regulatory integrity | §3a |
| N1 (B62 compliance) | **PR1** — B62 compliance | §4a |
| N2 (the bank's own footprint) | **PR2** — The bank's own footprint | §4b |
| N3 (three missing pillars) | **PR3** — The three missing pillars | §6a |
| N4 (presentation mechanics) | **PR4** — Presentation mechanics | §7a |
| ND (documentation & accuracy) | **PRD** — Regulatory documentation & accuracy | §8a |

PR0 is sequenced **between P0 and P1** so the provider-independent core is fixed before P1 locks it to
100%. The full sequencing rationale and dependency graph are in PROJECT_PLAN §9; milestones in §11. The
per-task detail below remains the authoritative source for *what each task is* — PROJECT_PLAN carries
the *status*. Do not maintain status in two places.

**ID scheme:** `N0`–`N4` for the remediation tiers, `ND` for documentation. These N-IDs are retained as
the task IDs *inside* their PR phases in PROJECT_PLAN (e.g. N0.1 is a row under Phase PR0). Chosen to
avoid collision with the existing `P0.x`–`P5.x` IDs.

**Status legend** (same as PROJECT_PLAN): ☐ not started · ◐ in progress · ☑ done · ⊘ dropped

**Effort** is engineer-days.

---

## 0. The architectural principle that should govern all of this

The gap analysis found three places where demo and live do not merely differ in *data* — they differ in
*computation*:

- `buildSummary()` (`lib/demo/portfolio.ts:502`) and `recomputeSummary()` (`lib/api/bfi.ts:239`) are a
  duplicated aggregator pair. Their own `AGGREGATOR-PAIR` comments warn they must be kept in step.
  **They are already out of step** — and the comment in `bfi.ts:229` points at `lib/data/portfolio.ts`,
  a path that no longer exists, so the warning cannot even be followed.
- The enterprise-value floor is `Math.max(1_000_000, borrower.enterpriseValueUsd)` in demo
  (`portfolio.ts:345`) and `Math.max(1, b.enterpriseValueUsd || 1)` in live (`api/bfi.ts:190`). The
  attribution factor — and therefore the disclosed tonnage — depends on which path served the request.
- The PCAF methodology note is a hardcoded string asserting a method rather than a description of the
  one actually used (`portfolio.ts:832`).

So the disclosed number is a function of code path, not only of data. That is the single most damaging
fact in the gap analysis, because it means **the demo does not prove anything about what live will
compute**, and a bank's own figure could change if the serving path changed.

**Principle: one computation, two providers.**

> Everything that decides a regulatory number lives in `lib/regulatory/**` as pure functions over a
> normalised domain model. `lib/demo/**` and the live provider differ only in **which data populates
> that model**. Neither may contain arithmetic, thresholds, floors, or method strings that affect a
> disclosed figure.

Practical consequences, which several tasks below implement:

1. **Demo fixtures become data, not branches.** Today a borrower reaches PCAF Score 1 only by matching
   the substring `"ghorahi"` (`demo/fixtures.ts:41`). Under the principle, the demo seeds a borrower
   *with an assurance-statement evidence document attached*, and the same scoring code that a live bank
   runs reads that evidence and returns Score 1. The demo then exercises the real path.
   **This is smaller than it looks:** `pcaf/scoring.ts` is already written to take fixtures from the
   caller rather than hold them (`:52-54`, `:161`), so the change is to the shape of what is injected —
   evidence records instead of name lists — not to the module's structure.
2. **Policy constants move to `lib/regulatory`.** EV floors, retail factors, thresholds — one documented
   home, one value, cited to PCAF or NRB where applicable.
3. **Derived, not asserted, methodology text.** The methodology note should be generated from what the
   computation actually did (which PCAF option, which denominator, which factor source), so it cannot
   describe a method the code did not use.
4. **The existing guard scripts extend to cover this.** `scripts/check-demo-imports.mjs` already stops
   `lib/regulatory` importing `lib/demo`. Add a check for duplicated aggregators and for policy
   constants declared outside `lib/regulatory`.

Every task below carries **Demo** and **Live** columns: `shared` means one code path serves both after
the change, which is the preferred outcome.

---

## 1. Tier N0 — Integrity blockers

Nothing else should ship before these. They are the reason the gap analysis is marked INTERNAL.

| S | # | Task | Why | Files | Demo | Live | Eff |
|---|---|------|-----|-------|------|------|-----|
| ☑ | N0.1 | **Fixed (PR0-c).** Collapsed the duplicated pair into one pure `summarise(loans, borrowers, attributions)` in `lib/regulatory/pcaf/aggregation.ts`, keeping the optimized Map-based implementation (the demo `buildSummary()` had O(n²) `Array.find()` scans + dead code in its trend loop). The demo synthesizer now calls `summarise()` (`buildSummary`/`emptyTaxonomy` deleted); `api/bfi.ts`'s `recomputeSummary()` is reduced to a hoisted thin re-export wrapper so its three consumers (`overlayLive`, `pcaf-overlay.ts`, the live-overlay golden) are unchanged. Verified arithmetic-neutral analytically and by the live-overlay equivalence golden (asserts demo == live summary). Added a `duplicate-aggregator` (`function buildSummary`) pattern to `check-regulatory-boundary.mjs` that fails immediately on any new hand-rolled aggregator outside `lib/regulatory`. See PROJECT_PLAN §13. | Disclosed total depends on serving path | `regulatory/pcaf/aggregation.ts`, `demo/portfolio.ts`, `api/bfi.ts` | shared | shared | 2 |
| ☑ | N0.2 | **Single EV floor policy.** DONE: added `lib/regulatory/pcaf/attribution.ts` — `pcafAttributionFactor(outstandingUsd, borrower)` and `flooredEnterpriseValueUsd(borrower)` with named constants `PCAF_EV_FLOOR_FACILITY_USD` (1M) / `PCAF_EV_FLOOR_NON_FACILITY_USD` (50k), cited to PCAF Part A §4.2 (attribution denominator guard). Both aggregators now call it: `demo/portfolio.ts` lost its tiered `Math.max(1_000_000/50_000, ev)` floor and `api/bfi.ts` lost the divergent `Math.max(1, ev\|\|1)` floor. Arithmetic-neutral: facility-tier EVs are always ≥ 5M (cement ≥5M, hydro ≥8M, industrial 40–200M) so the 1M floor never binds; the live path only reaches the facility branch. All 24 goldens frozen (incl. live-overlay 9,774,371 tCO₂e). `ev-floor-million` grandfather dropped from `check-regulatory-boundary.mjs`, so any new floor literal outside `lib/regulatory` now fails the build. | Two denominators, two answers | `demo/portfolio.ts:345`, `api/bfi.ts:190` | shared | shared | 1 |
| ☑ | N0.3 | **Move the demo-only reduction-target hash out of `lib/regulatory`.** DONE: `stableHash(...) % 100 < 15` + four canned strings relocated from `lib/regulatory/climate/infer.ts` to `lib/demo/climate-seed.ts`. `inferEmissionsFlag`/`getBorrowerClimateBundle`/`summarisePortfolioClimate` take an optional injected `ReductionTargetSeedFn` and assert no target when absent (honest live default). Demo injects via the provider (`demoReductionTargetSeed`); the two client components (`esrm-tab`, `climate-risk-panel`) read a server-computed `emissionsFlags` map on `DashboardSsrData` rather than importing the fixture. All 24 goldens frozen; boundary guards pass. | Fabricated data in the live path; feeds the NFRS climate callout | `regulatory/climate/infer.ts:250-268` | demo seed | removed | 1 |
| ☑ | N0.4 | **Fixed (PR0-c) — evidence-driven scoring.** The two published-emissions flags (Score 1/2) are no longer inferred from names: `inferPcafAvailability` dropped its `nameFixtures` param + `matchAny` and leaves both `const false`; they are raised only by a verified evidence document through the existing `resolveAvailability()` (the live-officer path). The demo fabricates the *evidence* not the *flag* — new `lib/demo/pcaf-evidence-seed.ts` (`demoPcafEvidenceRecords`) seeds a verified `assurance-opinion` (→Score 1) / `ghg-inventory` (→Score 2, `reportingYear = LATEST_FULL_YEAR`) for the same borrowers the fixtures matched, run through the same resolver; live seeds nothing. Deleted `PCAF_NAME_FIXTURES_*` + the `pcafNameFixtures`/`demoPcafNameFixtures` provider machinery (provider now exposes `pcafEvidenceRecords(borrower)`). Rewired all six consumers (`portfolio.ts`, `pcaf-overlay.ts`, availability + evidence API routes, `check-demo-boundary.ts` rewritten to assert the seed). Arithmetic-neutral: histogram frozen `{1:5, 2:39, 3:991, 5:79000}`, `bestTwo=44`; goldens updated in place. Per confirmed scope this was **fixtures only** — the demo-only cement `publiclyListed` heuristic in `entities.ts:212` (label/method string, never on the live path) is intentionally left in place. No boundary-guard baseline entry to remove (fabricated data, not a policy constant). See PROJECT_PLAN §13. | Only route to Score 1/2 is a hardcoded name | `demo/fixtures.ts:41-60` → `demo/pcaf-evidence-seed.ts`, `pcaf/scoring.ts:52-54,161` | seeded evidence | shared | 3 |
| ☑ | N0.5 | **Fixed (PR0-c) — disclosed as illustrative.** `RETAIL_TCO2E_PER_NPR = 6e-6` (Score-5 retail proxy intensity, previously behind a comment admitting it was "calibrated so the headline stays under 10M tCO2e") moved out of `demo/portfolio.ts` into a sanctioned home `lib/regulatory/pcaf/retail.ts` (`RETAIL_TCO2E_PER_NPR`, `RETAIL_PROXY_CITATION` = PCAF Part A §5.5/§5.6, `retailProxyEmissionsTonnes(outstandingNpr)`). Value unchanged → arithmetic-neutral, all 24 goldens frozen. The chart-tuning admission is deleted and replaced with a ⚠️ PROVENANCE caveat: the number is an ILLUSTRATIVE DEMONSTRATION ASSUMPTION, **not** a sourced factor, and MUST be derived from a citable published intensity or the retail book EXCLUDED before real disclosure. `portfolio.ts` imports the helper + citation. `retail-emissions-factor` grandfather removed — the **last** one; the guard BASELINE is now empty. Approach (disclose vs derive vs exclude) chosen by the user: disclose-as-illustrative. See PROJECT_PLAN §13. | A disclosure figure tuned to a chart | `demo/portfolio.ts:256-265` → `lib/regulatory/pcaf/retail.ts` | shared | shared | 1.5 |
| ☑ | N0.6 | **Fixed (PR0-b).** The undated `NPR_PER_USD = 133.5` moved out of `lib/units.ts` into `lib/regulatory/fx/rates.ts` as a dated, sourced `REPORTING_FX_RATE` (`FxRate {nprPerUsd, asOf, source}`; 133.5 as of 2024-07-15, NRB FY2023/24-close reference), satisfying S1 §24's rate-and-date requirement; `units.ts` re-exports it so the value is unchanged (arithmetic-neutral). Guard `npr-per-usd` grandfather removed. See PROJECT_PLAN §13. | Undated constant in a disclosed figure | `lib/units.ts:19` → `lib/regulatory/fx/rates.ts` | shared | shared | 1.5 |
| ☑ | N0.7 | **Fixed (PR0-b).** The reporting-period boundary moved to `lib/regulatory/reporting/period.ts` (`TREND_YEARS`, `LATEST_FULL_YEAR`, `LATEST_YEAR`, derived `AS_OF_DATE = 2025-10-31`, `isPartialYear`/`isFullyReportedYear`); `lib/reporting/periods.ts` re-exports it. The four inline hardcodings (`nfrs-tab.tsx` YoY/KPI/DisclosurePreview, `charts.tsx` partial-year) now read the shared helpers. The demo's overloaded `AS_OF_DATE` was split: loan-lifecycle anchor → `SYNTH_ANCHOR_DATE` (value unchanged, KPIs frozen); `meta.asOfDate` → the regulatory reporting `AS_OF_DATE`, reconciling the disclosed as-of with the `/api/pcaf/scores` docstring (2025-10-31). Guard `as-of-date` grandfather removed. See PROJECT_PLAN §13. | Period is a disclosure primitive | `reporting/periods.ts:21`, `nfrs-tab.tsx:37,72,417`, `charts.tsx:189`, `synth-util.ts:19` | shared | shared | 2 |
| ☑ | N0.8 | **Fixed (PR0-a).** `bankClassForTenant()` returned `"A"` unconditionally — bank class is now a `TenantConfig.bankClass` field (`lib/tenants/types.ts`), set per tenant in the registry and read by the function. Both demo tenants are Class A → zero figure movement. See PROJECT_PLAN §13. | Wrong class on a regulatory filing | `reports/nrbsis-green-statement.ts:239` | shared | shared | 0.25 |
| ☑ | N0.9 | **Fixed (PR0-a).** Dropped the fabricated "NFRS draft §17(b)"; re-pointed financed emissions to IFRS S2 Appendix B (B58–B63; B62(d) allocation-method disclosure) and framed PCAF as the *chosen* method, not a mandate. See PROJECT_PLAN §13. | A wrong citation on a disclosure surface | `nfrs-tab.tsx:468-473` | shared | shared | 0.25 |
| ☑ | N0.10 | **Fixed (PR0-a).** Added `scripts/check-regulatory-boundary.mjs` (8th `prebuild` guard, run by CI). Fails on any *new* policy constant/duplicated aggregator outside `lib/regulatory`; grandfathers the known occurrences (warn-only) so PR0-b/c tighten the net as each relocates. N0.6's `npr-per-usd`, N0.7's `as-of-date`, N0.2's `ev-floor-million`, and N0.5's `retail-emissions-factor` entries were removed as those landed, and N0.1 added a `duplicate-aggregator` (`function buildSummary`) pattern that fails immediately; **the BASELINE is now empty — every known occurrence has been relocated into `lib/regulatory` and the guard fails on any reintroduction.** See PROJECT_PLAN §13. | Prevents regression of N0.1–N0.7 | `scripts/check-*.mjs` | — | — | 1 |

**Exit criterion:** the same inputs produce the same disclosed figure regardless of provider, and no
value that reaches a disclosure originates in `lib/demo` or a name list.

---

## 2. Tier N1 — Make the existing number meet B62

This is what turns "we publish a financed-emissions figure" into "we satisfy the paragraph we cite".

| S | # | Task | Standard | Demo | Live | Eff |
|---|---|------|----------|------|------|-----|
| ☐ | N1.1 | **Gross exposure** per industry per asset class, funded carrying amount **before loss allowance**, in presentation currency. Model it; surface it. | B62(b) | shared | needs loss-allowance field from bank | 3 |
| ☐ | N1.2 | **Percentage of gross exposure included** in the financed-emissions calculation, with the **types of assets excluded** named. Replace the current facility-matched ÷ in-scope ratio, which has a different denominator. | B62(c), (c)(i) | shared | shared | 2 |
| ☐ | N1.3 | **Exclude risk mitigants** from gross exposure, explicitly. | B62(c)(ii) | shared | shared | 1 |
| ☐ | N1.4 | **Undrawn loan commitments** as a first-class asset class, with the percentage included disclosed **separately** from drawn. | B62(a)(ii), (c)(iii) | seed undrawn | needs CBS field | 3 |
| ☐ | N1.5 | **Industry × asset-class disaggregation** of absolute gross financed emissions. | B62(a) | shared | shared | 4 |
| ☐ | N1.6 | **Scope 1 / 2 / 3 split of financed emissions** within that matrix. Requires borrower-level scope data or a documented estimation basis. | B62(a) | shared | shared | 4 |
| ☐ | N1.7 | **NRB-sector → GICS 6-digit mapping table** for counterparty industry. **Confirmed required** — ND.2 found the NFRS draft mandates GICS with no alternative permitted. Not contingent. | B62(a)(i) | shared | shared | 3 |
| ☐ | N1.8 | **Real asset-class router.** Ten PCAF classes are declared; five are reachable; two traverse the option ladder. Implement the classes a Nepal commercial book actually contains and make the rest explicitly unsupported rather than silently unreachable. | B62(a)(ii), PCAF §5 | shared | shared | 4 |
| ☐ | N1.9 | **Per-asset-class attribution denominators.** EVIC (§5.1), equity+debt (§5.2), total project cost (§5.3) — not one EV for everything. Update the UI hint, which currently says "loan outstanding ÷ enterprise value" for every row. | PCAF §5 | shared | shared | 3 |
| ☐ | N1.10 | **Derived methodology disclosure** replacing the hardcoded string: which option, which denominator, which factor source, per loan and in aggregate. | B62(d), §29(a)(iii) | shared | shared | 2 |
| ☐ | N1.11 | **Extent of primary-activity data and extent of verified data**, as disclosed metrics. The PCAF evidence matrix already holds most of the inputs. | B55–B56 | shared | shared | 2 |
| ☐ | N1.12 | **Consolidation approach** (equity share or control) as a configured, disclosed per-bank property. | B27 | shared | shared | 1 |
| ☐ | N1.13 | **Per-tenant reporting FX rate and reporting period — wire the live override N0.6/N0.7 left stubbed.** Today live and demo share the *same pinned constants*: `REPORTING_FX_RATE` (133.5, as-of 2024-07-15) in `lib/regulatory/fx/rates.ts` and the derived `AS_OF_DATE`/`TREND_YEARS` in `lib/regulatory/reporting/period.ts`. Both files' "WHAT A LIVE DEPLOYMENT DOES" docstrings (`fx/rates.ts:24-30`, `period.ts` docstring + `AS_OF_DATE`) describe a live bank sourcing its *own* dated rate and deriving the period from *ingested Climate TRACE coverage* — **that behaviour is aspirational, not implemented; there is no tenant override.** Add `TenantConfig.reportingFxRate` (an `FxRate`) and `TenantConfig.reportingPeriod` (mirroring the N0.8 `bankClass` pattern), and have the live aggregator (`api/bfi.ts` `recomputeSummary`/`fetchLiveAndOverlay`) read the tenant values and derive `TREND_YEARS`/`LATEST_YEAR`/as-of from the coverage actually fetched, falling back to the pinned constants when unset. Demo tenants leave both unset → identical arithmetic (goldens frozen). Then replace the aspirational docstrings with a pointer to this task. **N0.6 and N0.7 deliberately made this possible** — the dated `FxRate` object and the derived, single-source `AS_OF_DATE` are the seams — without wiring the override, which is a live-path capability, not a demo-integrity fix. | S1 §24 (rate + date), B62 currency; §29(a)(iii) as-of | unset → pinned fallback (no movement) | reads tenant `reportingFxRate` + derives period from ingested coverage | 2 |

**Exit criterion:** the financed-emissions disclosure satisfies B62(a)–(d) in full, and every figure in it
can be traced to an input and a method. A live tenant discloses its *own* dated FX rate and a reporting
period derived from its ingested coverage; the `lib/regulatory` docstrings describe implemented behaviour,
not an aspiration (N1.13).

---

## 3. Tier N2 — The bank's own footprint

Currently absent entirely, and conspicuous in a product called a financed emissions platform.

| S | # | Task | Standard | Demo | Live | Eff |
|---|---|------|----------|------|------|-----|
| ☐ | N2.1 | **Scope 1 capture** — fuel, fleet, refrigerants — with evidence attachment. Small data model, mandatory disclosure. | §29(a)(i) | seeded | officer capture | 3 |
| ☐ | N2.2 | **Scope 2, location-based** — mandatory basis under B30. Market-based optional and only where contractual instruments exist. | §29(a)(v), B30–B31 | seeded | officer capture | 3 |
| ⊘ | N2.3 | ~~Seven-gas model~~ **Dropped.** B22 first sentence exempts factors already expressed in CO₂e from GWP recalculation, and every factor and feed we have is CO₂e-basis — the ingested Climate TRACE extract is a single `co2e_2024` column with no per-gas breakout. A single CO₂e scalar is the compliant shape. Residual obligation folded into N2.6. | B20–B22 | — | — | ~~4~~ 0 |
| ☐ | N2.4 | **Resolve the hydro CH₄ / CO₂ contradiction — up to a 30× error.** `entities.ts:250` computes `capacityMw × 15` and calls it "tCO₂/MW/yr"; `pcaf/scoring.ts:183,349` tell the user the same factor is an "IPCC 2019 reservoir **CH₄** EF (Vol.4 Ch.7)". Stored raw into `annualCo2eTonnes` with no GWP conversion. If it is CH₄, the true CO₂e is ~28–30× higher. Establish which is right, apply GWP₁₀₀ if gas-specific (B22 second sentence), align both modules. | B22, correctness | shared | shared | 1 |
| ☐ | N2.4b | **Cement factor is CO₂-basis, disclose it as such.** `CEMENT_TCO2_PER_TONNE = 0.75` (`entities.ts:78`) is calcination + combustion CO₂ in a field named `annualCo2eTonnes`. Non-CO₂ fraction ~1%, so this understates rather than misstates — a B29 disclosure fix, not a recalculation. | B29 | shared | shared | 0.25 |
| ☐ | N2.5 | **Scope 1/2 disaggregation** between consolidated group and other investees. | §29(a)(iv) | shared | shared | 1.5 |
| ☐ | N2.6 | **Emission-factor registry** — which factor, from which source, for which activity, with the disclosure B29 requires. **Each entry carries a basis flag: CO₂e-converted or gas-specific.** Gas-specific entries get latest-IPCC GWP₁₀₀ applied at computation; CO₂e entries are used as-is under the B22 exemption. This is the whole of what remains from the dropped N2.3. | B29, B22 | shared | shared | 2.5 |

---

## 4. Tier N3 — The three missing pillars

Governance, strategy and risk management are structured narrative capture with evidence attachment —
closer in shape to the ESDD wizard than to the PCAF engine. That is the cheapest credible route.

| S | # | Task | Standard | Demo | Live | Eff |
|---|---|------|----------|------|------|-----|
| ☐ | N3.1 | **Governance disclosure capture** — oversight body, how responsibilities are set, skills and competencies, how and how often informed, trade-offs, whether climate metrics enter remuneration. | S2 §6 | seeded sample | bank capture | 4 |
| ☐ | N3.2 | **Risk management process disclosure** — identification, assessment, prioritisation, monitoring; whether scenario analysis informs it; how climate is prioritised relative to other risks; integration into overall risk management. Much of the underlying process already exists (Annex 5, Annex 5b, CAP, NGFS categories) and can be referenced rather than re-entered. | S2 §25 | seeded sample | bank capture | 4 |
| ☐ | N3.3 | **Strategy disclosure** — risks classified physical or transition, time horizons and their link to planning horizons, business model and value-chain concentration. | S2 §10, §13 | seeded sample | bank capture | 4 |
| ☐ | N3.4 | **Transition plan capture** (only where the bank has one; no obligation to have one). | S2 §14(a)(iv) | seeded sample | bank capture | 2 |
| ☐ | N3.5 | **Targets** — metric, objective, scope of application, period, base period, milestones, absolute vs intensity, gases and scopes covered, gross vs net, planned use of carbon credits and verifying scheme. | S2 §§33–36 | seeded sample | bank capture | 5 |
| ☐ | N3.6 | **Cross-industry metrics** §29(b)–(d): amount and percentage of assets vulnerable to transition risk, to physical risk, and aligned with climate opportunities. Note the existing Green/Amber/Red totals are NRB taxonomy classification and must **not** be relabelled as §29(d) without a mapping. | S2 §29(b)–(d) | shared | shared | 4 |
| ☐ | N3.7 | **Capital deployment, internal carbon price, remuneration** — three small captured metrics. | S2 §29(e)–(g) | seeded | bank capture | 2 |
| ☐ | N3.8 | **Scenario analysis and climate resilience.** The largest single build. §22 mandates it and B17 requires a quantitative approach where exposure is material and resources exist. This is the same engine the Additional Risk Modules catalogue describes — hazard exposure carried through to financial effect — so scope it once and serve both. | S2 §22, B1–B18 | shared | shared | 20+ |

**Note on N3.8.** This is the bridge between the disclosure workstream and the commercial roadmap. NRB
Risk Management Guidelines 2026 §8.4 also points at it (see
`corporate-documents/sales/03_Nepal_BFI/_Research/NRB_Risk_Management_Guidelines_2026_Climate_Chapter.md`).
Do not start it before Tier N1 is complete.

---

## 5. Tier N4 — Presentation and reporting mechanics

| S | # | Task | Standard | Demo | Live | Eff |
|---|---|------|----------|------|------|-----|
| ☐ | N4.1 | **Comparatives** for all disclosed amounts, with a restatement mechanism and an "as previously reported" record. Neither export currently has a prior-period column. | S1 §70, B49–B53 | shared | shared | 4 |
| ☐ | N4.2 | **Materiality judgements** capture and disclosure. | S1 §74, B19–B29 | seeded | bank capture | 2 |
| ☐ | N4.3 | **Connected information** — link disclosed figures to financial statement line items. | S1 §21, B39–B44 | shared | shared | 3 |
| ☐ | N4.4 | **Measurement uncertainty** disclosure — amounts subject to high uncertainty, sources, assumptions. | S1 §§77–81 | shared | shared | 2 |
| ☐ | N4.5 | **Transition-relief flags** — first-year reliefs under S1 E3–E6 and S2 C3–C5 are a configured, disclosed property of the reporting period, not a code assumption. A bank omitting financed emissions in year one under C4(b) must be able to say so. | S1 E3–E6, S2 C3–C5 | shared | shared | 2 |

---

## 6. Documentation workstream

Runs alongside the code. Several items are corrections to claims we are currently making.

| S | # | Task | Why | Eff |
|---|---|------|-----|-----|
| ☐ | ND.1 | **Retire "the platform delivers NFRS S1/S2 disclosure"** across all sales and product material. It delivers part of one paragraph of S2 plus the evidence trail. Gap analysis §9 has the replacement claims. | Accuracy | 0.5 |
| ☑ | ND.2 | **IFRS S2 vintage — verified 19 Sep 2026.** The NFRS drafts track the original **June 2023** text. The ISSB amendments were issued **11 December 2025** (not December 2024) and are effective 1 Jan 2027. ASB Nepal drafted on the unamended text four months after they were published. **GICS and latest-IPCC GWPs are both mandatory for us**; no relief available. Written up as gap analysis §7.1. | Unblocked N1.7 | 0.5 |
| ☐ | ND.11 | **Route the vintage point to ASB Nepal** via NRB, ICAN or IFC. The comment window closed 6 June 2026 but the standards are not final, and IFC is already running the consultation and ToT programme with ASB — the obvious channel. The two provisions the ISSB relaxed (GICS, IPCC GWPs) are the two that bite hardest on a Nepali commercial bank. | Regulatory influence; would cut N1.7 and part of N2.3 | 0.5 |
| ☐ | ND.3 | **Stop presenting PCAF as what the standard requires.** Neither standard mentions PCAF; B62(d) asks only that the allocation method be disclosed. Adjust the brochures and the user manual. | Accuracy | 0.5 |
| ☐ | ND.4 | **Correct the research note** `research/03-nfrs-s1-s2-requirements.md`: the B40 characteristics are "listed in no particular order" not a ranked ladder; §22(b)(i)(4) is disclose-whether not use-one; the E4 nine-month backstop does not apply to E4(a); the scope over-read in §1.2. | Feeds our own reasoning | 1 |
| ☐ | ND.5 | **Add NRB Risk Management Guidelines 2026 to the regulatory source pack** (`docs/regulatory-sources/`, new `11-nrb-risk-management/`) via `download.sh`, and add Chapter VIII to `HOW_THE_DEMO_USES_THESE.md`. | Primary source missing | 0.5 |
| ☐ | ND.6 | **Add a Chapter VIII section to the gap analysis** — the regulatory picture changed after it was written. | Currency | 1 |
| ☐ | ND.7 | **Document the demo/live computation boundary** in `ARCHITECTURE.md` — the principle in §0 above, plus what the guard scripts enforce. | Prevents recurrence | 1 |
| ☐ | ND.8 | **User manual v0.4** once N0 and N1 land: the disclosure surface will have changed materially. Rebuild figures via `npm run capture:manual`. | Manual accuracy | 2 |
| ☐ | ND.9 | **Residual "Circular 22" citations in code comments** — roughly a dozen files. Some are legitimate Excel cell references; several are operative citations. | Consistency with P46 | 1 |
| ☐ | ND.10 | **Timeline guidance for sales** — one page: no NFRS effective date, C4(b) defers financed emissions to year two, Chapter VIII is supervisory expectation with soft modals. Prevents the urgency overclaim. | Sales accuracy | 0.5 |

---

## 7. Suggested sequencing

```
N0 (integrity)  ──► N1 (B62)  ──► N2 (own footprint)  ──► N3 (pillars)  ──► N4 (presentation)
     │                  │                                      │
     └─ ND.1, ND.3      └─ ND.2 (blocks N1.7)                  └─ N3.8 needs N1 complete
        ND.4, ND.5
        ND.7
```

**Do N0 first and completely.** It is 10.5 days and it converts the platform from "a demo whose numbers
happen to look right" into "a system whose numbers are reproducible". Everything after it is additive;
without it, everything after it is built on a figure that depends on which code path ran.

**~~ND.2 before N1.7.~~ Resolved 19 September 2026.** The NFRS drafts track the pre-amendment June 2023
text, so the ISSB's GICS relief is not available to us and N1.7 stays a full mapping project. Same for the
IPCC GWP relief, which hardens N2.3. ND.11 is the only remaining lever, and it is a regulatory-influence
play rather than a scheduling dependency — do not hold N1.7 for it.

**N3.8 is the commercial pivot, not the next task.** Scenario analysis serves S2 §22, NRB Chapter VIII
§8.4, and the entire Additional Risk Modules catalogue. It is also 20+ days and depends on portfolio
data quality that Tier N1 is what establishes.

---

## 8. Rough totals

| Tier | Days |
|---|---|
| N0 — integrity | 10.5 |
| N1 — B62 compliance | 34 |
| N2 — own footprint | 11.25 |
| N3 — three pillars (excl. N3.8) | 25 |
| N3.8 — scenario analysis | 20+ |
| N4 — presentation | 13 |
| ND — documentation | 8.5 |

Estimates are for a single engineer familiar with the codebase and exclude the test coverage that
PROJECT_PLAN Phase P1 requires for `lib/regulatory/**`. Every task in N0–N2 touches that directory, so
each carries a test obligation under the 100% line-and-branch gate (P1.5). **Budget roughly +40% on
N0–N2 for tests**, or sequence P1.5 after N0 rather than before.
