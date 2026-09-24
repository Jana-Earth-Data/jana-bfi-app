/**
 * TIER 1 UNIT TEST — NRB Green Finance Taxonomy (2024) activity classifiers.
 * jana-bfi-app · Task P1.3 of PROJECT_PLAN.md.
 *
 * WHAT THIS COVERS AND WHY
 * ------------------------
 * Two pure regulatory modules turn officer answers into the Green / Amber / Red
 * verdict the bank discloses against the NRB Green Finance Taxonomy:
 *
 *   • lib/regulatory/taxonomy/activities.ts — the 19-activity catalog. Each
 *     activity carries a pure `classify(answers)` that returns a
 *     TaxonomyClassification { color, rationale, citation, dnshFailures? }. The
 *     colour is what the wizard prints and what the portfolio rolls up, so every
 *     green/amber/red/unclassified boundary is a disclosure boundary.
 *
 *   • lib/regulatory/taxonomy/dnsh.ts — the shared "Do No Significant Harm"
 *     library. `evaluateDnsh(checkIds, answers)` fails a yes_no check unless the
 *     answer at `dnsh_<checkId>` is strictly `true`; classifiers gate on
 *     `dnsh.passed`. `getDnshCriteria()` materialises the questions the wizard
 *     appends to each activity.
 *
 * TABLE-DRIVEN, DERIVED FROM THE STANDARD (TEST_STRATEGY §4.1)
 * -----------------------------------------------------------
 * Cases assert the resolved COLOUR (and, for DNSH, the passed/failedCheckIds
 * accounting) against answer objects hand-derived from the NRB Annex 2 cells —
 * not read back from the code. Fixtures pass DNSH by setting every `dnsh_*` key
 * the activity references to `true` (see `dnshPass`), so an activity's own
 * criteria are exercised in isolation from the shared DNSH gate; separate cases
 * flip one DNSH key to prove the gate fires. Every activity in the catalog gets
 * at least its reachable colours pinned, plus catalog-integrity guards so a
 * re-numbered id or a dropped activity is caught.
 *
 * COVERAGE NOTE (for the P1.5 100% gate / P1.7 cleanup): the classifiers reach
 * 100% statement/function/line and every reachable branch. `num()`/`yn()`
 * helpers are exercised via the activities that read numeric (hydro LCA, cement
 * alt-fuel %, personal-home-loan cap) and boolean answers. TWO genuinely-dead
 * defensive branches remain and are documented so the P1.5 gate treats them as
 * known, not as a test gap:
 *
 *   • activities.ts findActivityById() line 1766 — the `?? null` fallback of
 *     `TAXONOMY_ACTIVITIES.find((a) => a.id === aliased)`. Unreachable: every
 *     entry in LEGACY_ID_ALIASES maps to an id that IS in the catalog, so once
 *     an alias resolves the find() always hits. Only a future alias pointing at
 *     a removed activity could take the null arm.
 *   • dnsh.ts evaluateDnsh() line 336 — the implicit else of the
 *     `check.criterion.type === "yes_no"` guard. Unreachable today: every
 *     DNSH_CHECKS criterion is type "yes_no" (there is no numeric DNSH check
 *     yet; the code comments that path as a future extension point). The
 *     "skips unknown check ids" test exercises the `if (!check) continue` guard
 *     above it.
 */
import {
  TAXONOMY_ACTIVITIES,
  findActivityById,
  suggestActivitiesForSector,
  type TaxonomyActivity,
  type TaxonomyClassification,
} from "@/lib/regulatory/taxonomy/activities";
import {
  DNSH_CHECKS,
  evaluateDnsh,
  getDnshCriteria,
} from "@/lib/regulatory/taxonomy/dnsh";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Look an activity up by id or fail loudly (keeps the tables readable). */
function activity(id: string): TaxonomyActivity {
  const a = TAXONOMY_ACTIVITIES.find((x) => x.id === id);
  if (!a) throw new Error(`test fixture: no activity "${id}" in catalog`);
  return a;
}

/**
 * All DNSH answer keys the activity references, each set to `true` so
 * evaluateDnsh() passes. Merge this into an answer object to isolate the
 * activity-specific criteria from the shared DNSH gate.
 */
function dnshPass(id: string): Record<string, true> {
  const a = activity(id);
  const out: Record<string, true> = {};
  for (const checkId of a.dnshCheckIds) {
    const check = DNSH_CHECKS[checkId];
    if (check) out[check.criterion.id] = true;
  }
  return out;
}

/** Classify an activity by id with a given answer object. */
function classify(
  id: string,
  answers: Record<string, unknown>,
): TaxonomyClassification {
  return activity(id).classify(answers);
}

// ---------------------------------------------------------------------------
// Catalog integrity — the wizard + portfolio rely on these being stable.
// ---------------------------------------------------------------------------

describe("taxonomy catalog · integrity", () => {
  const EXPECTED_IDS = [
    "hydro",
    "wind-energy",
    "solar-utility",
    "cement-whr",
    "green-buildings",
    "organic-agri",
    "dairy-livestock",
    "poultry",
    "aquaculture",
    "food-processing",
    "textile-garments",
    "ev-consumer",
    "ev-commercial",
    "fossil-generation",
    "irrigation-efficiency",
    "waste-management",
    "hotel-tourism",
    "personal-home-loan",
    "green-financial-intermediation",
  ];

  it("pins the exact set of activity ids", () => {
    const ids = TAXONOMY_ACTIVITIES.map((a) => a.id).sort();
    expect(ids).toEqual([...EXPECTED_IDS].sort());
  });

  it("every activity has a citation, sector label, and non-empty criteria", () => {
    for (const a of TAXONOMY_ACTIVITIES) {
      expect(a.nrbCitation).toMatch(/NRB GFT 2024/);
      expect(a.sectorLabel.length).toBeGreaterThan(0);
      expect(a.criteria.length).toBeGreaterThan(0);
    }
  });

  it("resolved criteria = activity criteria + one criterion per DNSH check", () => {
    for (const a of TAXONOMY_ACTIVITIES) {
      // Each referenced DNSH check appends exactly one criterion; its id must
      // appear in the resolved list so the wizard asks it.
      for (const checkId of a.dnshCheckIds) {
        const critId = DNSH_CHECKS[checkId]?.criterion.id;
        expect(critId).toBeDefined();
        expect(a.criteria.some((c) => c.id === critId)).toBe(true);
      }
    }
  });

  it("every classify() returns a valid colour for an empty answer set", () => {
    const valid = new Set(["green", "amber", "red", "unclassified"]);
    for (const a of TAXONOMY_ACTIVITIES) {
      const res = a.classify({});
      expect(valid.has(res.color)).toBe(true);
      expect(res.rationale.length).toBeGreaterThan(0);
      expect(res.citation).toMatch(/NRB GFT 2024/);
    }
  });
});

describe("taxonomy catalog · findActivityById + legacy aliases", () => {
  it("resolves a direct id", () => {
    expect(findActivityById("hydro")?.id).toBe("hydro");
  });

  it("resolves legacy hydro capacity-band ids to hydro", () => {
    for (const legacy of ["hydro-small", "hydro-medium", "hydro-large"]) {
      expect(findActivityById(legacy)?.id).toBe("hydro");
    }
  });

  it("resolves legacy ev-transport to ev-consumer", () => {
    expect(findActivityById("ev-transport")?.id).toBe("ev-consumer");
  });

  it("returns null for an unknown id", () => {
    expect(findActivityById("does-not-exist")).toBeNull();
  });
});

describe("taxonomy catalog · suggestActivitiesForSector", () => {
  it("matches on a substring of an applicableTo pattern (case-insensitive)", () => {
    const hits = suggestActivitiesForSector("Hydropower generation").map(
      (a) => a.id,
    );
    expect(hits).toContain("hydro");
  });

  it("matches multiple renewable activities for a 'renewable' sector", () => {
    const hits = suggestActivitiesForSector("renewable").map((a) => a.id);
    expect(hits).toEqual(
      expect.arrayContaining(["hydro", "wind-energy", "solar-utility"]),
    );
  });

  it("returns [] when nothing matches", () => {
    expect(suggestActivitiesForSector("zzz-no-such-sector")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// DNSH library — the shared gate every environmental activity leans on.
// ---------------------------------------------------------------------------

describe("dnsh · evaluateDnsh", () => {
  it("passes when every referenced yes_no check answers true", () => {
    const answers = {
      dnsh_environmental_flow: true,
      dnsh_resettlement_discharged: true,
    };
    const res = evaluateDnsh(
      ["environmental_flow", "resettlement_discharged"],
      answers,
    );
    expect(res.passed).toBe(true);
    expect(res.failures).toEqual([]);
    expect(res.failedCheckIds).toEqual([]);
  });

  it("fails a check whose answer is missing", () => {
    const res = evaluateDnsh(["environmental_flow"], {});
    expect(res.passed).toBe(false);
    expect(res.failedCheckIds).toEqual(["environmental_flow"]);
    expect(res.failures).toEqual([
      DNSH_CHECKS.environmental_flow.failureReason,
    ]);
  });

  it("fails a check answered with a non-true value (false / 'yes' string)", () => {
    for (const bad of [false, "yes", 1, null, undefined]) {
      const res = evaluateDnsh(["land_use_conflict"], {
        dnsh_land_use_conflict: bad,
      });
      expect(res.passed).toBe(false);
      expect(res.failedCheckIds).toEqual(["land_use_conflict"]);
    }
  });

  it("collects every failing check, preserving order", () => {
    const res = evaluateDnsh(
      ["effluent_treatment", "air_emissions_compliance"],
      { dnsh_effluent_treatment: true }, // only the first passes
    );
    expect(res.passed).toBe(false);
    expect(res.failedCheckIds).toEqual(["air_emissions_compliance"]);
  });

  it("silently skips unknown check ids (defensive)", () => {
    const res = evaluateDnsh(["no_such_check"], {});
    expect(res.passed).toBe(true);
    expect(res.failedCheckIds).toEqual([]);
  });

  it("passes trivially for an empty check list", () => {
    expect(evaluateDnsh([], {}).passed).toBe(true);
  });
});

describe("dnsh · getDnshCriteria", () => {
  it("materialises one criterion per known check id, in order", () => {
    const crits = getDnshCriteria([
      "effluent_treatment",
      "air_emissions_compliance",
    ]);
    expect(crits.map((c) => c.id)).toEqual([
      "dnsh_effluent_treatment",
      "dnsh_air_emissions_compliance",
    ]);
  });

  it("drops unknown check ids", () => {
    const crits = getDnshCriteria(["effluent_treatment", "bogus"]);
    expect(crits.map((c) => c.id)).toEqual(["dnsh_effluent_treatment"]);
  });

  it("every DNSH check criterion id follows the dnsh_<checkId> convention", () => {
    for (const [checkId, check] of Object.entries(DNSH_CHECKS)) {
      expect(check.criterion.id).toBe(`dnsh_${checkId}`);
    }
  });
});

// ---------------------------------------------------------------------------
// §7.1 Hydro — numeric LCA bands + technical gate + DNSH downgrade.
// ---------------------------------------------------------------------------

describe("activity · hydro (§7.1)", () => {
  // A green baseline: run-of-river, EIA current, avoids red zones, LCA < 100,
  // DNSH all passed.
  const greenBase = (): Record<string, unknown> => ({
    run_of_river_no_reservoir: true,
    eia_or_iee_current: true,
    avoids_protected_and_disaster_zones: true,
    lifecycle_gco2e_per_kwh: 40,
    ...dnshPass("hydro"),
  });

  it("GREEN: run-of-river + EIA + LCA<100 + DNSH passed", () => {
    expect(classify("hydro", greenBase()).color).toBe("green");
  });

  it("GREEN via power-density gate instead of run-of-river", () => {
    const a = greenBase();
    a.run_of_river_no_reservoir = false;
    a.power_density_above_5 = true;
    expect(classify("hydro", a).color).toBe("green");
  });

  it("RED: site overlaps a protected / disaster zone (hard red first)", () => {
    const a = greenBase();
    a.avoids_protected_and_disaster_zones = false;
    expect(classify("hydro", a).color).toBe("red");
  });

  it("RED: no current EIA/IEE", () => {
    const a = greenBase();
    a.eia_or_iee_current = false;
    expect(classify("hydro", a).color).toBe("red");
  });

  it("RED: neither run-of-river nor power-density gate", () => {
    const a = greenBase();
    a.run_of_river_no_reservoir = false;
    expect(classify("hydro", a).color).toBe("red");
  });

  it("UNCLASSIFIED: LCA not entered", () => {
    const a = greenBase();
    a.lifecycle_gco2e_per_kwh = undefined;
    expect(classify("hydro", a).color).toBe("unclassified");
  });

  it("RED: LCA at/above the 425 Amber ceiling", () => {
    const a = greenBase();
    a.lifecycle_gco2e_per_kwh = 425;
    expect(classify("hydro", a).color).toBe("red");
  });

  it("AMBER: LCA in the 100..<425 band, DNSH passed", () => {
    const a = greenBase();
    a.lifecycle_gco2e_per_kwh = 200;
    expect(classify("hydro", a).color).toBe("amber");
  });

  it("AMBER + dnshFailures: Amber band with a failing DNSH check", () => {
    const a = greenBase();
    a.lifecycle_gco2e_per_kwh = 200;
    a.dnsh_environmental_flow = false;
    const res = classify("hydro", a);
    expect(res.color).toBe("amber");
    expect(res.dnshFailures && res.dnshFailures.length).toBeGreaterThan(0);
  });

  it("AMBER (downgrade): Green LCA band but a DNSH check fails", () => {
    const a = greenBase();
    a.dnsh_biodiversity_offset = false;
    const res = classify("hydro", a);
    expect(res.color).toBe("amber");
    expect(res.dnshFailures && res.dnshFailures.length).toBeGreaterThan(0);
  });

  it("boundary: LCA exactly 100 is Amber, 99 is Green", () => {
    const at = greenBase();
    at.lifecycle_gco2e_per_kwh = 100;
    expect(classify("hydro", at).color).toBe("amber");
    const below = greenBase();
    below.lifecycle_gco2e_per_kwh = 99;
    expect(classify("hydro", below).color).toBe("green");
  });
});

// ---------------------------------------------------------------------------
// §7.3 Wind — study hard-red, DNSH amber, clean-tech green vs amber.
// ---------------------------------------------------------------------------

describe("activity · wind-energy (§7.3)", () => {
  const base = (): Record<string, unknown> => ({
    bird_biodiversity_study_completed: true,
    energy_efficient_clean_tech: true,
    includes_battery_storage: false,
    ...dnshPass("wind-energy"),
  });

  it("GREEN: study + clean-tech + no land-use conflict", () => {
    expect(classify("wind-energy", base()).color).toBe("green");
  });

  it("RED: missing biodiversity study", () => {
    const a = base();
    a.bird_biodiversity_study_completed = false;
    expect(classify("wind-energy", a).color).toBe("red");
  });

  it("AMBER: study done but DNSH land-use conflict fails", () => {
    const a = base();
    a.dnsh_land_use_conflict = false;
    expect(classify("wind-energy", a).color).toBe("amber");
  });

  it("AMBER: study + DNSH ok but not clean-tech", () => {
    const a = base();
    a.energy_efficient_clean_tech = false;
    expect(classify("wind-energy", a).color).toBe("amber");
  });

  it("GREEN with battery storage annotates the rationale", () => {
    const a = base();
    a.includes_battery_storage = true;
    const res = classify("wind-energy", a);
    expect(res.color).toBe("green");
    expect(res.rationale).toMatch(/storage/i);
  });
});

// ---------------------------------------------------------------------------
// §7.4 Solar — DNSH-first red, PV/grid amber levers, green default.
// ---------------------------------------------------------------------------

describe("activity · solar-utility (§7.4)", () => {
  const base = (): Record<string, unknown> => ({
    grid_interconnection_approved: true,
    pv_component_meets_nrb_efficiency: true,
    battery_recycling_plan: false,
    ...dnshPass("solar-utility"),
  });

  it("GREEN: grid + PV compliant + non-conflicted site", () => {
    expect(classify("solar-utility", base()).color).toBe("green");
  });

  it("RED: DNSH land-use conflict (site overlaps protected land)", () => {
    const a = base();
    a.dnsh_land_use_conflict = false;
    expect(classify("solar-utility", a).color).toBe("red");
  });

  it("AMBER: PV efficiency below NRB footnote-337 minimums", () => {
    const a = base();
    a.pv_component_meets_nrb_efficiency = false;
    expect(classify("solar-utility", a).color).toBe("amber");
  });

  it("AMBER: PV ok but grid interconnection pending", () => {
    const a = base();
    a.grid_interconnection_approved = false;
    expect(classify("solar-utility", a).color).toBe("amber");
  });

  it("GREEN with a battery recycling plan annotates the rationale", () => {
    const a = base();
    a.battery_recycling_plan = true;
    const res = classify("solar-utility", a);
    expect(res.color).toBe("green");
    expect(res.rationale).toMatch(/battery/i);
  });
});

// ---------------------------------------------------------------------------
// §5.11 Cement — NO Green column; DNSH-first red, Amber-lever gate.
// ---------------------------------------------------------------------------

describe("activity · cement-whr (§5.11 — Amber max, no Green)", () => {
  const base = (): Record<string, unknown> => ({
    dry_process_kiln: true,
    alt_fuel_or_low_carbon_kiln: false,
    efficient_kiln_60pct_masonry_share: false,
    whr_operational: false,
    alternative_fuel_share_pct: 0,
    ...dnshPass("cement-whr"),
  });

  it("AMBER is the best outcome (a dry-process kiln lever is in place)", () => {
    expect(classify("cement-whr", base()).color).toBe("amber");
  });

  it("RED: DNSH (air emissions / quarry) fails", () => {
    const a = base();
    a.dnsh_air_emissions_compliance = false;
    expect(classify("cement-whr", a).color).toBe("red");
  });

  it("RED: no NRB Amber lever (WHR alone cannot carry the classification)", () => {
    const a = base();
    a.dry_process_kiln = false;
    a.whr_operational = true; // Jana editorial lever — insufficient alone
    expect(classify("cement-whr", a).color).toBe("red");
  });

  it("AMBER: an alt-fuel/low-carbon kiln lever alone is enough", () => {
    const a = base();
    a.dry_process_kiln = false;
    a.alt_fuel_or_low_carbon_kiln = true;
    a.alternative_fuel_share_pct = 30;
    expect(classify("cement-whr", a).color).toBe("amber");
  });

  it("never returns green even with every lever set", () => {
    const a = base();
    a.alt_fuel_or_low_carbon_kiln = true;
    a.efficient_kiln_60pct_masonry_share = true;
    a.whr_operational = true;
    a.alternative_fuel_share_pct = 50;
    expect(classify("cement-whr", a).color).toBe("amber");
  });
});

// ---------------------------------------------------------------------------
// §6.1/§6.2 Green buildings — site hard-red, cert OR dudbc green, design amber.
// ---------------------------------------------------------------------------

describe("activity · green-buildings (§6.1/§6.2)", () => {
  const base = (): Record<string, unknown> => ({
    certified_leed_edge_cbi: false,
    meets_dudbc_codes: false,
    site_avoids_iucn_arable_disaster: true,
    considers_orientation_hazards_habitat: false,
  });

  it("RED: site on IUCN / arable / disaster / cultural zone", () => {
    const a = base();
    a.site_avoids_iucn_arable_disaster = false;
    expect(classify("green-buildings", a).color).toBe("red");
  });

  it("GREEN: LEED/EDGE/CBI certified on a clean site", () => {
    const a = base();
    a.certified_leed_edge_cbi = true;
    expect(classify("green-buildings", a).color).toBe("green");
  });

  it("GREEN via DUDBC codes path", () => {
    const a = base();
    a.meets_dudbc_codes = true;
    expect(classify("green-buildings", a).color).toBe("green");
  });

  it("AMBER: no cert but Amber design considerations", () => {
    const a = base();
    a.considers_orientation_hazards_habitat = true;
    expect(classify("green-buildings", a).color).toBe("amber");
  });

  it("RED: no cert, no DUDBC, no design considerations", () => {
    expect(classify("green-buildings", base()).color).toBe("red");
  });
});

// ---------------------------------------------------------------------------
// §1.1 Organic agri — cert+noChems green, partial amber, else unclassified.
// ---------------------------------------------------------------------------

describe("activity · organic-agri (§1.1)", () => {
  it("GREEN: certified organic + no synthetic agrochemicals", () => {
    expect(
      classify("organic-agri", {
        organic_certified: true,
        no_synthetic_agrochems: true,
      }).color,
    ).toBe("green");
  });

  it("AMBER: partial climate-smart lever without full certification", () => {
    expect(
      classify("organic-agri", { climate_smart_practices: true }).color,
    ).toBe("amber");
  });

  it("UNCLASSIFIED: conventional agriculture, no levers", () => {
    expect(classify("organic-agri", {}).color).toBe("unclassified");
  });
});

// ---------------------------------------------------------------------------
// §1.11 Dairy — forest-conversion hard-red, DNSH amber, all-levers green.
// ---------------------------------------------------------------------------

describe("activity · dairy-livestock (§1.11)", () => {
  const base = (): Record<string, unknown> => ({
    improved_low_emission_breeds: true,
    manure_management_biogas: true,
    slaughterhouse_effluent_ok: true,
    grazing_avoids_forest_conversion: true,
    ...dnshPass("dairy-livestock"),
  });

  it("GREEN: breeds + manure + slaughter + no forest conversion + DNSH", () => {
    expect(classify("dairy-livestock", base()).color).toBe("green");
  });

  it("RED: converts forest / over-grazes", () => {
    const a = base();
    a.grazing_avoids_forest_conversion = false;
    expect(classify("dairy-livestock", a).color).toBe("red");
  });

  it("AMBER: DNSH effluent check fails", () => {
    const a = base();
    a.dnsh_effluent_treatment = false;
    expect(classify("dairy-livestock", a).color).toBe("amber");
  });

  it("AMBER: some but not all Green levers", () => {
    const a = base();
    a.manure_management_biogas = false;
    a.slaughterhouse_effluent_ok = false;
    expect(classify("dairy-livestock", a).color).toBe("amber");
  });

  it("UNCLASSIFIED: no Green levers but no red/DNSH failure", () => {
    const a = {
      grazing_avoids_forest_conversion: true,
      ...dnshPass("dairy-livestock"),
    };
    expect(classify("dairy-livestock", a).color).toBe("unclassified");
  });
});

// ---------------------------------------------------------------------------
// §1.12 Poultry — DNSH amber, all-levers green, partial amber, else unclass.
// ---------------------------------------------------------------------------

describe("activity · poultry (§1.12)", () => {
  const base = (): Record<string, unknown> => ({
    biosecure_climate_resilient_housing: true,
    manure_recovery_or_biogas: true,
    clean_energy_farm: true,
    ...dnshPass("poultry"),
  });

  it("GREEN: housing + manure + clean energy + DNSH", () => {
    expect(classify("poultry", base()).color).toBe("green");
  });

  it("AMBER: DNSH effluent fails", () => {
    const a = base();
    a.dnsh_effluent_treatment = false;
    expect(classify("poultry", a).color).toBe("amber");
  });

  it("AMBER: one lever only", () => {
    const a = { biosecure_climate_resilient_housing: true, ...dnshPass("poultry") };
    expect(classify("poultry", a).color).toBe("amber");
  });

  it("UNCLASSIFIED: no levers", () => {
    expect(classify("poultry", { ...dnshPass("poultry") }).color).toBe(
      "unclassified",
    );
  });
});

// ---------------------------------------------------------------------------
// §2.1 Aquaculture — habitat hard-red, DNSH amber, rec+native green.
// ---------------------------------------------------------------------------

describe("activity · aquaculture (§2.1)", () => {
  const base = (): Record<string, unknown> => ({
    closed_or_recirculating_system: true,
    native_or_certified_species: true,
    wetland_and_habitat_avoided: true,
    ...dnshPass("aquaculture"),
  });

  it("GREEN: RAS + native species + habitat avoided + DNSH", () => {
    expect(classify("aquaculture", base()).color).toBe("green");
  });

  it("RED: converts wetland / protected aquatic habitat", () => {
    const a = base();
    a.wetland_and_habitat_avoided = false;
    expect(classify("aquaculture", a).color).toBe("red");
  });

  it("AMBER: DNSH effluent fails", () => {
    const a = base();
    a.dnsh_effluent_treatment = false;
    expect(classify("aquaculture", a).color).toBe("amber");
  });

  it("AMBER: one of the two green criteria only", () => {
    const a = base();
    a.native_or_certified_species = false;
    expect(classify("aquaculture", a).color).toBe("amber");
  });
});

// ---------------------------------------------------------------------------
// §4.1 Food processing — DNSH amber, eff+cert green, partial amber, unclass.
// ---------------------------------------------------------------------------

describe("activity · food-processing (§4.1)", () => {
  const base = (): Record<string, unknown> => ({
    energy_water_efficient: true,
    certified_food_safety: true,
    packaging_recycled_biodegradable: false,
    ...dnshPass("food-processing"),
  });

  it("GREEN: efficient + certified food safety + DNSH", () => {
    expect(classify("food-processing", base()).color).toBe("green");
  });

  it("GREEN with recyclable packaging annotates the rationale", () => {
    const a = base();
    a.packaging_recycled_biodegradable = true;
    const res = classify("food-processing", a);
    expect(res.color).toBe("green");
    expect(res.rationale).toMatch(/packaging/i);
  });

  it("AMBER: DNSH (effluent/air) fails", () => {
    const a = base();
    a.dnsh_air_emissions_compliance = false;
    expect(classify("food-processing", a).color).toBe("amber");
  });

  it("AMBER: only one green lever (packaging)", () => {
    const a = {
      packaging_recycled_biodegradable: true,
      ...dnshPass("food-processing"),
    };
    expect(classify("food-processing", a).color).toBe("amber");
  });

  it("UNCLASSIFIED: no levers", () => {
    expect(
      classify("food-processing", { ...dnshPass("food-processing") }).color,
    ).toBe("unclassified");
  });
});

// ---------------------------------------------------------------------------
// §5.2 Textile — microplastic hard-red, DNSH red, fibres+dye green, else amber.
// ---------------------------------------------------------------------------

describe("activity · textile-garments (§5.2)", () => {
  const base = (): Record<string, unknown> => ({
    sustainable_fibres: true,
    eco_dyeing_and_low_water: true,
    avoids_microplastic_release: true,
    ...dnshPass("textile-garments"),
  });

  it("GREEN: sustainable fibres + eco-dyeing + no microplastic + DNSH", () => {
    expect(classify("textile-garments", base()).color).toBe("green");
  });

  it("RED: unmitigated microplastic release", () => {
    const a = base();
    a.avoids_microplastic_release = false;
    expect(classify("textile-garments", a).color).toBe("red");
  });

  it("RED: DNSH dye-effluent check fails (textile red bullet)", () => {
    const a = base();
    a.dnsh_effluent_treatment = false;
    expect(classify("textile-garments", a).color).toBe("red");
  });

  it("AMBER: some but not all green criteria (fibres without dye)", () => {
    const a = base();
    a.eco_dyeing_and_low_water = false;
    expect(classify("textile-garments", a).color).toBe("amber");
  });
});

// ---------------------------------------------------------------------------
// §17.2 EV consumer — binary BEV green / hybrid amber / else red. No DNSH.
// ---------------------------------------------------------------------------

describe("activity · ev-consumer (§17.2)", () => {
  it("GREEN: battery-electric", () => {
    expect(classify("ev-consumer", { battery_electric: true }).color).toBe(
      "green",
    );
  });

  it("AMBER: hybrid engine", () => {
    expect(classify("ev-consumer", { hybrid_engine: true }).color).toBe(
      "amber",
    );
  });

  it("RED: neither (fossil-fuel vehicle)", () => {
    expect(classify("ev-consumer", {}).color).toBe("red");
  });

  it("BEV wins over a co-set hybrid flag", () => {
    expect(
      classify("ev-consumer", { battery_electric: true, hybrid_engine: true })
        .color,
    ).toBe("green");
  });
});

// ---------------------------------------------------------------------------
// §9.10 EV commercial — bev+renew green, bev-only amber, hybrid amber, red.
// ---------------------------------------------------------------------------

describe("activity · ev-commercial (§7.6/§9.10)", () => {
  it("GREEN: BEV fleet + renewable charging", () => {
    expect(
      classify("ev-commercial", {
        battery_electric_fleet: true,
        charging_uses_renewable: true,
      }).color,
    ).toBe("green");
  });

  it("AMBER: BEV fleet but fossil-fired charging", () => {
    expect(
      classify("ev-commercial", { battery_electric_fleet: true }).color,
    ).toBe("amber");
  });

  it("AMBER: hybrid / efficient fossil fleet", () => {
    expect(
      classify("ev-commercial", { hybrid_or_efficient_fossil: true }).color,
    ).toBe("amber");
  });

  it("RED: fossil-fuel passenger fleet", () => {
    expect(classify("ev-commercial", {}).color).toBe("red");
  });
});

// ---------------------------------------------------------------------------
// §7.5 Fossil generation — always red.
// ---------------------------------------------------------------------------

describe("activity · fossil-generation (§7.5)", () => {
  it("RED regardless of answers", () => {
    expect(classify("fossil-generation", {}).color).toBe("red");
    expect(classify("fossil-generation", { confirms_fossil: true }).color).toBe(
      "red",
    );
  });
});

// ---------------------------------------------------------------------------
// §1.15 Irrigation — bad-practice hard-red, efficient+ green, one-lever amber.
// ---------------------------------------------------------------------------

describe("activity · irrigation-efficiency (§1.15)", () => {
  const base = (): Record<string, unknown> => ({
    drip_sprinkler_solar_lift: true,
    rainwater_or_recharge: true,
    smart_or_programmed: false,
    avoids_diesel_and_deep_boring: true,
  });

  it("GREEN: efficient system + rainwater/smart, no bad practice", () => {
    expect(classify("irrigation-efficiency", base()).color).toBe("green");
  });

  it("GREEN via the efficient + smart-control combination", () => {
    const a = base();
    a.rainwater_or_recharge = false;
    a.smart_or_programmed = true;
    expect(classify("irrigation-efficiency", a).color).toBe("green");
  });

  it("RED: diesel pumps / deep boring / over-extraction", () => {
    const a = base();
    a.avoids_diesel_and_deep_boring = false;
    expect(classify("irrigation-efficiency", a).color).toBe("red");
  });

  it("AMBER: one green lever only (rainwater without efficient system)", () => {
    const a = base();
    a.drip_sprinkler_solar_lift = false;
    expect(classify("irrigation-efficiency", a).color).toBe("amber");
  });

  it("UNCLASSIFIED: no green levers, no bad practice", () => {
    expect(
      classify("irrigation-efficiency", {
        avoids_diesel_and_deep_boring: true,
      }).color,
    ).toBe("unclassified");
  });
});

// ---------------------------------------------------------------------------
// §15.2 Waste management — hazwaste hard-red, DNSH amber, seg+disposal green.
// ---------------------------------------------------------------------------

describe("activity · waste-management (§15.2)", () => {
  const base = (): Record<string, unknown> => ({
    segregation_and_recycling: true,
    sanitary_landfill_or_wte: true,
    hazardous_waste_managed: true,
    ...dnshPass("waste-management"),
  });

  it("GREEN: segregation + sanitary disposal + hazwaste managed + DNSH", () => {
    expect(classify("waste-management", base()).color).toBe("green");
  });

  it("RED: hazardous / medical waste not managed", () => {
    const a = base();
    a.hazardous_waste_managed = false;
    expect(classify("waste-management", a).color).toBe("red");
  });

  it("AMBER: DNSH (effluent/air) fails", () => {
    const a = base();
    a.dnsh_effluent_treatment = false;
    expect(classify("waste-management", a).color).toBe("amber");
  });

  it("AMBER: hazwaste ok + DNSH ok but only one operational lever", () => {
    const a = base();
    a.sanitary_landfill_or_wte = false;
    expect(classify("waste-management", a).color).toBe("amber");
  });
});

// ---------------------------------------------------------------------------
// §13.2 Hotel — site hard-red, DNSH amber, all-levers green, partial amber.
// ---------------------------------------------------------------------------

describe("activity · hotel-tourism (§13.2)", () => {
  const base = (): Record<string, unknown> => ({
    clean_energy_and_efficiency: true,
    water_efficiency_wastewater: true,
    waste_and_plastic_reduction: true,
    site_avoids_protected_areas: true,
    ...dnshPass("hotel-tourism"),
  });

  it("GREEN: clean energy + water + waste on a clean site + DNSH", () => {
    expect(classify("hotel-tourism", base()).color).toBe("green");
  });

  it("RED: site overlaps protected / sensitive cultural area", () => {
    const a = base();
    a.site_avoids_protected_areas = false;
    expect(classify("hotel-tourism", a).color).toBe("red");
  });

  it("AMBER: DNSH effluent fails", () => {
    const a = base();
    a.dnsh_effluent_treatment = false;
    expect(classify("hotel-tourism", a).color).toBe("amber");
  });

  it("AMBER: some but not all green levers", () => {
    const a = base();
    a.water_efficiency_wastewater = false;
    a.waste_and_plastic_reduction = false;
    expect(classify("hotel-tourism", a).color).toBe("amber");
  });

  it("UNCLASSIFIED: clean site + DNSH ok but no green levers", () => {
    const a = {
      site_avoids_protected_areas: true,
      ...dnshPass("hotel-tourism"),
    };
    expect(classify("hotel-tourism", a).color).toBe("unclassified");
  });
});

// ---------------------------------------------------------------------------
// §17.4 Personal home loan — cap gate, site red, cert green, solar amber.
// ---------------------------------------------------------------------------

describe("activity · personal-home-loan (§17.4)", () => {
  const base = (): Record<string, unknown> => ({
    loan_amount_npr_million: 10,
    green_certified_home: false,
    solar_water_efficient: false,
    site_outside_hazard_zones: true,
  });

  it("UNCLASSIFIED: loan above the Rs. 15M cap (re-classify under §12.1)", () => {
    const a = base();
    a.loan_amount_npr_million = 20;
    expect(classify("personal-home-loan", a).color).toBe("unclassified");
  });

  it("RED: home on hazard / IUCN / arable / cultural site", () => {
    const a = base();
    a.site_outside_hazard_zones = false;
    expect(classify("personal-home-loan", a).color).toBe("red");
  });

  it("GREEN: green-certified home within cap on a clean site", () => {
    const a = base();
    a.green_certified_home = true;
    expect(classify("personal-home-loan", a).color).toBe("green");
  });

  it("AMBER: solar/water-efficient but not certified", () => {
    const a = base();
    a.solar_water_efficient = true;
    expect(classify("personal-home-loan", a).color).toBe("amber");
  });

  it("UNCLASSIFIED: no green/amber levers within cap on a clean site", () => {
    expect(classify("personal-home-loan", base()).color).toBe("unclassified");
  });

  it("boundary: exactly 15M is within the cap (not unclassified-by-cap)", () => {
    const a = base();
    a.loan_amount_npr_million = 15;
    a.green_certified_home = true;
    expect(classify("personal-home-loan", a).color).toBe("green");
  });
});

// ---------------------------------------------------------------------------
// §11.1 Green financial intermediation — exclusion red, green+icma green.
// ---------------------------------------------------------------------------

describe("activity · green-financial-intermediation (§11.1)", () => {
  const base = (): Record<string, unknown> => ({
    proceeds_to_green_amber: true,
    excludes_carbon_intensive: true,
    icma_gbp_aligned: true,
  });

  it("GREEN: ring-fenced proceeds + exclusion + ICMA GBP aligned", () => {
    expect(classify("green-financial-intermediation", base()).color).toBe(
      "green",
    );
  });

  it("RED: does not exclude carbon-intensive activities", () => {
    const a = base();
    a.excludes_carbon_intensive = false;
    expect(classify("green-financial-intermediation", a).color).toBe("red");
  });

  it("AMBER: ring-fenced proceeds but no ICMA GBP alignment", () => {
    const a = base();
    a.icma_gbp_aligned = false;
    expect(classify("green-financial-intermediation", a).color).toBe("amber");
  });

  it("UNCLASSIFIED: excludes carbon-intensive but no green ring-fencing", () => {
    expect(
      classify("green-financial-intermediation", {
        excludes_carbon_intensive: true,
      }).color,
    ).toBe("unclassified");
  });
});
