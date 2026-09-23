---
title: "NFRS S1 / S2 — Gap Analysis"
subtitle: "What the standards require, what the platform produces, and what is missing"
author: "Jana Earth Data"
date: "18 September 2026"
---

**INTERNAL**

_Assessed against the NFRS S1 and NFRS S2 exposure drafts published by ASB Nepal on 7 April 2026
(`docs/regulatory-sources/03-nfrs-icann/`), read in full, and against the platform as it stands on
branch `feature/20260907_1`. Paragraph citations are the standards' own. Code citations are file:line._

---

# 1. The finding that reframes the question

**NFRS S1 and S2 are IFRS S1 and S2 with terminology substituted.** There is no meaningful
Nepal-specific divergence to analyse.

- Paragraph architecture is identical: S1 is "set out in paragraphs 1–86 and Appendices A–E", S2 in
  "paragraphs 1–37 and Appendices A–C" — the same as the IFRS originals, heading for heading.
- The word "IFRS" appears eight times in each PDF, **all of them in the Preface and the chairman's
  messages. Zero occurrences in the operative text.**
- The substitutions are mechanical: *IFRS Sustainability Disclosure Standards* → *Nepal Sustainability
  Disclosure Standards*; *ISSB* → *ASB Nepal*; *IFRS Accounting Standards* → *NFRS Accounting
  Standards*; *Industry-based Guidance on Implementing IFRS S2* → *…NFRS S2*.

Everything a small market might have been expected to localise was left verbatim: SASB Standards remain
a mandatory reference point (S1 §55(a), §58(a), §59(a)); GICS 6-digit codes remain mandatory for
financed-emissions disaggregation (S2 B62(a)(i)); GHG Protocol 2004 and the Scope 3 Standard 2011 remain
the measurement basis; Appendix C still points at GRI and the European standards.

**No Nepal regulatory instrument is cited anywhere in the operative text.** Zero hits across both PDFs
for "PCAF", "ESRM", "taxonomy" or "Green Finance". "Nepal Rastra" appears once per document, in the
Preface list of committee members. The NRB ESRM Guideline and the Green Finance Taxonomy do not appear.

So the gap worth measuring is **platform against the standard**, not NFRS against IFRS.

## 1.1 Two facts we should stop getting wrong in our own materials

**There is no effective date.** S1 Appendix E, paragraph E1 and S2 Appendix C, paragraph C1 both read:

> "An entity shall apply this Standard for annual reporting periods beginning on or after **XX XX 202X**."

The placeholder is unfilled in both drafts. Any statement that NFRS S1/S2 is mandatory, or mandatory from
a particular year, is unsupported by these documents.

**The standards do not say who must apply them.** S1 §§5–9 describe how the Standard is applied by an
entity applying it; they assert no scope over any population of entities. Mandated applicability will
come from NRB, SEBON or the Nepal Insurance Authority, or from the final ASB Nepal pronouncement. Our
internal research note claims "on the face of the standards, every reporting entity in Nepal is in
scope" — that is an over-read and should be corrected.

## 1.2 A live defect in the standards themselves

S2 §12, §23 and §32 each contain a "shall refer to and consider the applicability of" obligation
pointing at the *Industry-based Guidance on Implementing NFRS S2*. **ASB Nepal has not published that
document.** Three mandatory reference obligations are currently unsatisfiable. Worth raising with NRB
or IFC — the formal comment window closed 6 June 2026.

---

# 2. Financed emissions — the one paragraph we address

For a commercial bank the operative requirement is **S2 §29(a)(vi)(2) and B62**. This is the whole of
our current disclosure claim, and we satisfy part of it.

| B62 requires | Platform produces | Assessment |
|---|---|---|
| **(a)** Absolute gross financed emissions **disaggregated by Scope 1, 2 and 3, for each industry by asset class** | A single portfolio total (`portfolio.ts:510`); a top-8 sector bar chart | **Major gap.** No scope split, no industry × asset-class matrix |
| **(a)(i)** Industry classified by **GICS 6-digit code**, latest version at reporting date | NRB sector classification. GICS appears nowhere in the codebase | **Not met** |
| **(a)(ii)** Asset classes **shall include** loans, project finance, bonds, equity, **undrawn loan commitments** | Ten PCAF classes declared (`pcaf/types.ts:24`) but only five reachable, and only two traverse the option ladder (`scoring.ts:72–102, 298`). Undrawn commitments absent | **Partial** |
| **(b)** **Gross exposure** per industry per asset class, funded carrying amount **before loss allowance**, presentation currency | In-scope outstanding NPR as a single KPI (`portfolio.ts:582`) | **Partial.** Not disaggregated; loss-allowance treatment undefined |
| **(c)** **Percentage of gross exposure included**; exclusions and asset types explained; **risk mitigants excluded**; undrawn stated separately | One ratio: facility-matched ÷ in-scope (`nfrs-tab.tsx:413`) | **Not met as specified.** Different denominator from the one required |
| **(d)** Methodology **including the allocation method** | A hardcoded prose string (`portfolio.ts:831`, and a different one at `api/bfi.ts:218`) | **Partial** |

Supporting requirements that also apply and are unaddressed: **§29(a)(iii)** measurement approach,
inputs, assumptions and changes with reasons; **B55–B56** the extent to which Scope 3 is measured using
primary activity data and the extent using verified data; **B27** the consolidation approach (equity
share or control) and the reason for it; **S1 §70** comparatives from year two.

## 2.1 PCAF is not what the standard asks for

**PCAF is never mentioned in either standard** — zero hits for "PCAF" or "Partnership for Carbon" across
both PDFs. B62(d) requires only that the allocation method be disclosed; PCAF is a legitimate way to
satisfy that, not a mandated one. Likewise the PCAF data quality score is *one way* of conveying
B55–B56, not a required metric.

This matters commercially. We currently present PCAF as though it were the standard's own machinery. The
defensible claim is narrower and still strong: PCAF is a recognised, documented allocation method that
satisfies B62(d), and moving a borrower from Score 5 to Score 3 improves the evidence base behind the
number — not that the standard demands a PCAF score.

## 2.2 Attribution mechanics

The attribution factor is `loan.outstandingUsd / enterpriseValue` with a floor
(`portfolio.ts:343–348`), applied uniformly. PCAF Part A uses different denominators per asset class —
EVIC for listed equity (§5.1), total equity plus debt for unlisted (§5.2), total project cost for project
finance (§5.3). The code does not distinguish them and the UI labels every row "loan outstanding ÷
enterprise value" (`nfrs-tab.tsx:351`).

Two code paths use **different EV floors** — `Math.max(1_000_000, …)` in the demo path versus
`Math.max(1, …)` in the live overlay (`api/bfi.ts:190`). The disclosed total therefore depends on which
path served the request. Both `buildSummary()` and `recomputeSummary()` carry comments warning that they
are a duplicated aggregator pair that must be kept in step; they are already out of step.

---

# 3. The larger gap — three of the four pillars

S2 follows the four-pillar structure. We occupy part of one.

| Pillar | Requirement | Status |
|---|---|---|
| **Governance** | §6 — oversight body, skills and competencies, how and how often informed, trade-offs considered, whether performance metrics enter remuneration | **Nothing.** Zero hits for "governance" across `lib/`, `components/`, `app/` |
| **Strategy** | §§10–21 — risks classified physical or transition, time horizons and their link to planning horizons, business model and value chain concentration, transition plan, current and anticipated financial effects | **Nothing** rendered as disclosure |
| **Strategy — climate resilience** | **§22 mandates scenario analysis.** B17: an entity with high exposure and available resources **is required** to apply a quantitative approach. B18: the resilience assessment must be carried out **annually** | **Nothing.** Zero hits for "scenario" |
| **Risk management** | §25 — processes to identify, assess, prioritise and monitor; whether scenario analysis informs identification; how climate risk is prioritised relative to other risks; integration into overall risk management | **No disclosure output.** Substantial operational machinery exists (Annex 5, Annex 5b, CAP, NGFS categories) but nothing renders §25 |
| **Metrics and targets** | §29(a) GHG; §29(b)–(g) cross-industry metrics; §32 industry metrics; §§33–36 targets | **Partial** — see below |

Within metrics and targets:

- **§29(b)–(d)** amount and percentage of assets vulnerable to transition risk, to physical risk, and
  aligned with climate opportunities — **not produced**. The Green/Amber/Red taxonomy totals are NRB
  classification, not an §29(d) alignment metric, and are never labelled as one.
- **§29(e)** capital deployed toward climate risks and opportunities — **nothing**.
- **§29(f)** internal carbon price and the price per tonne used — **nothing**.
- **§29(g)** percentage of executive remuneration linked to climate — **nothing**.
- **§§33–36** targets: metric, objective, scope of application, period, base period, milestones, absolute
  or intensity, how the latest international climate agreement informed it, gases and scopes covered,
  gross versus net, planned use of carbon credits — **nothing at bank level**. The only "target" in the
  system is a per-borrower boolean fabricated by hash (`climate/infer.ts:250`).
- **Comparatives** (S1 §70): a five-year trend chart and one year-on-year percentage. Neither export
  carries a prior-period column; there is no restatement mechanism.
- **Materiality judgements** (S1 §74, B19–B29) and **connected information** (S1 §21, B39–B44):
  **nothing**.

---

# 4. GHG mechanics — gaps that are not about financed emissions

**The bank's own Scope 1 and Scope 2 are absent.** We compute only Scope 3 Category 15. A bank still has
to disclose its own fuel, fleet and purchased electricity. §29(a)(v) and **B30** are emphatic that
**location-based Scope 2 is mandatory** ("For the avoidance of doubt…"), with market-based permitted only
as additional context where contractual instruments exist. Searching `lib/`, `components/` and `app/`
for "location-based" and "market-based" returns **zero hits** — Scope 2 is not unspecified, it is absent
as a concept.

**The seven gases — a correction to an earlier revision of this document.** Appendix A defines greenhouse
gases as the seven Kyoto gases, and B20 requires the disclosure be expressed as CO₂e. An earlier revision
read that as an obligation to model each gas separately. **It is not, and B22 says so explicitly:**

> "If these emission factors have already converted the constituent gases into CO₂ equivalent values, the
> entity is **not required to recalculate** the emission factors using global warming potential values
> based on a 100-year time horizon from the latest Intergovernmental Panel on Climate Change assessment…"

B21 (latest-IPCC GWPs) governs **direct measurement**. B22 first sentence governs **estimation from
emission factors**, which is what a financed-emissions calculation is and what this platform does
throughout. A single CO₂e scalar per facility is therefore the compliant shape, not a shortcut — and it is
what the underlying data gives us: the ingested Climate TRACE extract carries one column, `co2e_2024`
(`data/_raw_ct_emis_2024.csv`), with no per-gas breakout. There is no seven-gas model to build.

**What B22 does still require is its second sentence.** Where a factor is *not* already CO₂e-converted,
the entity must apply latest-IPCC 100-year GWPs. That bites on exactly one factor in the system, and it is
unresolved:

**The hydro factor contradicts itself across two modules.** `entities.ts:250` computes
`capacityMw * 15` and documents it as "~15 tCO₂/MW/yr". `pcaf/scoring.ts:183` and `:349` describe the same
factor to the user as an "IPCC 2019 reservoir **CH₄** EF (Vol.4 Ch.7)". Reservoir emissions genuinely are
methane-dominated, so the scoring text may well be the accurate description — but the value is then stored
raw into `annualCo2eTonnes` with no GWP conversion. **If 15 is tonnes of CH₄, the CO₂e figure is roughly
28–30× larger** at AR5/AR6 GWP₁₀₀. One of the two descriptions is wrong, and the spread between them is a
factor of thirty on every hydropower exposure in the book. Resolve before anything else in this section.

**The cement factor is a smaller, different problem.** `CEMENT_TCO2_PER_TONNE = 0.75` (`entities.ts:78`)
is a CO₂ figure — calcination plus fuel combustion — flowing into a field named `annualCo2eTonnes`. The
non-CO₂ combustion fraction is on the order of a percent, so this understates rather than misstates. It is
a B29 disclosure point (say the factor is CO₂-basis and CO₂-dominant), not a correction.

**§29(a)(iv) disaggregation** of Scope 1 and 2 between the consolidated accounting group and other
investees — not applicable until Scope 1 and 2 exist, but it shapes the data model.

**B27 consolidation approach** — the entity is required to use the equity share or control approach and
to disclose which. Nothing in the data model carries this.

---

# 5. Timeline — the transition reliefs are generous

This is the most commercially useful section, and it argues against urgency framing.

**S2 Appendix C, paragraph C4(b)** lets an entity omit Scope 3 in the first annual reporting period, and
says so explicitly for our case:

> "…includes, if the entity participates in asset management, commercial banking or insurance
> activities, the additional information about its financed emissions (see paragraph 29(a)(vi)(2) and
> paragraphs B58–B63)."

Combined with the other first-year provisions:

| Relief | Effect |
|---|---|
| **S2 C4(b)** | Financed emissions may be omitted entirely in year one |
| **S2 C4(a)** | An existing non-GHG-Protocol measurement method may be retained |
| **S1 E5** | Year one may cover **climate only**, not the full sustainability scope (must disclose that fact) |
| **S1 E4** | Sustainability disclosures may be published **after** the financial statements — up to nine months after year end for non-interim reporters |
| **S1 E3 / S2 C3** | **No comparatives** in year one |
| **S1 E6** | Where E5 is used, no comparatives for non-climate matters in year two either |
| **S2 C5** | Year-one reliefs carry into the year-two comparative column |

**A Nepali bank's first NFRS report can legitimately contain no financed emissions at all.** They bite in
**year two** — and there is no year one yet, because there is no effective date.

The honest framing for a bank: this is a capability to build before a deadline exists, not a filing tool
for a deadline that has arrived. That is a weaker urgency story and a stronger credibility story, and it
is consistent with what we have already told NMB and Laxmi.

**No proportionality by entity size, sector or asset threshold exists in either draft.** The only
proportionality mechanisms are the generic ones: materiality, "reasonable and supportable information
available without undue cost or effort" (S1 B6, B8–B10), and the scenario-analysis commensurability test
(S2 B1–B7).

---

# 6. Integrity issues before any of this touches a real book

Fine for a demonstration. Not fine the moment the disclosure preview points at a bank's own portfolio.

1. **Hardcoded name substrings decide PCAF scores.** `PCAF_NAME_FIXTURES_VERIFIED = ["ghorahi"]` and
   `PCAF_NAME_FIXTURES_UNVERIFIED = ["arghakhanchi", "hetauda cement", "butwal power"]`
   (`demo/fixtures.ts:41–60`). Matching one of those strings is the **only** path to Score 1 or Score 2.
   A second, independent name list in `entities.ts:212` sets `evSource: "public-filing"`, routing a
   borrower to Score 4 rather than 5.
2. **The retail factor is tuned to the chart.** `RETAIL_TCO2E_PER_NPR = 6e-6` (`portfolio.ts:265`), whose
   own comment instructs a re-tuner to confirm "the KPI 'Total financed emissions' stays under 10M tCO2e
   and the trend chart's Unclassified band is visible but not dominant."
3. **A demo-only rule sits in `lib/regulatory/`.** Whether an above-threshold borrower has a reduction
   target is `stableHash(...) % 100 < 15` (`climate/infer.ts:250`), with four canned target strings. It
   is labelled "demo only" but lives outside `lib/demo/`, so a live build inherits it. This feeds the
   NFRS tab's climate-threshold counters.
4. **One undated FX rate.** `NPR_PER_USD = 133.5` (`units.ts:19`), used for every conversion; its own
   docstring notes a disclosure needs a dated rate. S1 §24 requires the presentation currency of the
   related financial statements.
5. **Period boundaries hardcoded in four places** — `nfrs-tab.tsx:72` (`"2024"`), `:37` and `:417`
   (`year < 2025`), `charts.tsx:189` (`partialFromYear = 2025`), against
   `reporting/periods.ts:21–35`. `AS_OF_DATE = "2026-05-01"` (`synth-util.ts:19`) disagrees with the
   `/api/pcaf/scores` docstring's `"2025-10-31"`.
6. **`bankClassForTenant()` returns `"A"` unconditionally**, ignoring its argument
   (`nrbsis-green-statement.ts:239`).

---

# 7. Two things to verify before relying on them

## 7.1 The vintage question — VERIFIED 19 September 2026

**The drafts track the original June 2023 IFRS S2 text.** Confirmed against both the ASB Nepal exposure
drafts and the ISSB source.

The amendments in question are *Amendments to Greenhouse Gas Emissions Disclosures (Amendments to
IFRS S2)*, issued by the ISSB on **11 December 2025** — not December 2024, as an earlier revision of this
document said. They are effective for annual reporting periods beginning **on or after 1 January 2027**,
with early application permitted. They do four things:

1. permit an entity to limit measurement and disclosure of Scope 3 Category 15 to financed emissions as
   defined in IFRS S2;
2. **permit alternative classification systems beyond GICS** for disaggregating financed emissions;
3. clarify that the jurisdictional relief from the GHG Protocol is available where only *part* of an
   entity is required to use a different method;
4. **introduce a jurisdictional relief from using latest-IPCC GWP values.**

None of the four appears in the Nepal drafts. The text is verbatim pre-amendment:

| Marker | NFRS S2 ED (April 2026) | Vintage |
|---|---|---|
| B62(a)(i) industry classification | "the entity **shall** use the Global Industry Classification Standard (GICS) 6-digit industry-level code" — no alternative offered | June 2023 |
| B63(a)(i) (insurance) | identical GICS mandate | June 2023 |
| B21–B22 GWP | latest-IPCC 100-year values required; no jurisdictional relief | June 2023 |
| B25 partial-entity jurisdictional requirement | states the requirement "does **not** exempt the entity" — the opposite of amendment 3 | June 2023 |
| Scope 3 Category 15 / derivatives | the word "derivatives" does not appear anywhere in the document | June 2023 |
| Preface | cites only "IFRS S1 and S2 in June 2023"; makes no reference to any amendment | June 2023 |

**The timing is the notable part.** The ISSB amendments were issued 11 December 2025. ASB Nepal published
the exposure drafts on **7 April 2026** — four months later — on the unamended text, with the comment
period closing 6 June 2026. Neither draft has been finalised: as of today ASB Nepal's latest publication
is the second public consultation and training of trainers, 10–11 June 2026, still described as "Draft
NFRS S1 & S2".

**Consequences.**

- **GICS is mandatory for us to support.** We cannot plan on the ISSB relief. A Nepali bank applying
  NFRS S2 as drafted must classify counterparties to GICS 6-digit, and Nabil and NMB both classify on NRB
  sector codes. The NRB-sector-to-GICS mapping table is required work, not contingent work.
- **Latest-IPCC GWPs are mandatory too**, with no jurisdictional carve-out. Narrower than it sounds: B22
  exempts factors already expressed in CO₂e, which is most of ours. It bites only where a factor is
  gas-specific — see §4 on the hydro CH₄ contradiction.
- **There is a real comment to make.** Nepal is drafting onto a text the ISSB has already amended, and the
  two provisions that bite hardest on a Nepali commercial bank — GICS and IPCC GWPs — are precisely the
  two the ISSB relaxed. The comment window closed on 6 June 2026, but the standards are not final, so the
  point can still be routed to ASB Nepal through NRB, ICAN or IFC. IFC is already running the consultation
  and training programme with ASB, which is the obvious channel.
- **No effective date, still.** Both drafts read "on or after XX XX 202X" (NFRS S2 C1, NFRS S1 E1). Nothing
  in the finding changes the timeline position.

## 7.2 The citation question — still open

**The disclosure preview cites a paragraph that may not support it.** The methodology note prints
"PCAF Global GHG Accounting and Reporting Standard (Part A, Chapter 5), IFRS S2 §29, NFRS draft §17(b)"
(`nfrs-tab.tsx:468–473`). §29 is right. **§17(b)** does not obviously support a financed-emissions claim
in either standard — S1 §17 is the materiality requirement, S2 §17 concerns anticipated financial
effects. Check it, and correct or remove it.

---

# 8. Build order

Sequenced by regulatory weight against effort, not by ease.

**Tier 1 — makes the existing number defensible**

1. **B62(b) and (c) properly.** Gross exposure before loss allowance, the percentage of gross exposure
   included, the asset types excluded, risk mitigants excluded, undrawn commitments stated separately.
   This is arithmetic over data we largely hold, and without it the financed-emissions figure does not
   meet the paragraph it claims.
2. **B62(a) disaggregation** — industry × asset class. Requires a GICS mapping — the ISSB relief does not
   help us, see §7.1 — and a real asset-class router rather than one that can
   reach five values.
3. **§29(a)(iii) and B55–B56** — measurement approach, inputs, assumptions, changes and reasons; extent
   of primary-activity data; extent of verified data. The PCAF evidence matrix already holds most of
   what this needs.
4. Remove the demo-only rules from `lib/regulatory/` and the hardcoded name lists from the scoring path.

**Tier 2 — the bank's own footprint**

5. **Scope 1 and location-based Scope 2** capture. Small data model, mandatory disclosure, and currently
   a conspicuous hole in a product called a financed emissions platform.
6. **Resolve the hydro CH₄/CO₂ contradiction** and record, per emission factor, whether it is CO₂e-basis
   or gas-specific — applying latest-IPCC GWP₁₀₀ only to the latter (B22). No seven-gas model required.
7. **B27 consolidation approach** as a configured, disclosed property.

**Tier 3 — the other three pillars**

8. **Governance, strategy and risk management narrative capture** (§6, §§10–21, §25). These are
   structured text with evidence attachment, not modelling — closer to the ESDD wizard than to the PCAF
   engine, and a natural extension of surfaces we already have.
9. **Targets** (§§33–36), including gases and scopes covered, base period, milestones, gross versus net,
   and planned use of carbon credits.
10. **Scenario analysis and climate resilience** (§22, B1–B18). The largest single build, and the one
    the Additional Risk Modules catalogue is really describing — physical hazard modelling carried
    through to financial effect is exactly what §22(a) asks a bank to assess.

**Tier 4 — presentation**

11. Comparatives and restatement (S1 §70, B49–B53); materiality judgements (§74); connected information
    (§21, B39–B44).

---

# 9. What to say to a bank

Three claims that survive this analysis:

- The platform produces a financed-emissions figure with a documented allocation method and a stated
  evidence basis — which is what B62(d) and B55–B56 ask for, and more than a spreadsheet of sector
  averages provides.
- Financed emissions are a **year-two** obligation under C4(b), with no effective date set. The work to
  do now is building the borrower and facility data that makes a year-two number possible, because that
  data cannot be assembled retrospectively.
- Scenario analysis under §22 is mandatory and quantitative for a bank with material exposure and the
  resources to do it. That is the bridge from this platform to the additional risk modules, and it is a
  regulatory argument rather than a sales one.

One claim to retire: that the platform delivers NFRS S1/S2 disclosure. It delivers part of one paragraph
of S2, plus the operational evidence trail underneath it. Said plainly, that is still a good story.
