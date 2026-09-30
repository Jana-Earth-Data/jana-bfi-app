/**
 * Unit tests for bank operational footprint (Scope 1 and Scope 2 emissions).
 * Tests emission factor calculations, demo seeding, and aggregation.
 *
 * Created for N2.1 (Scope 1) and N2.2 (Scope 2).
 */

import { describe, it, expect } from "vitest";
import {
  calculateFuelEmissions,
  calculateRefrigerantEmissions,
  calculateFleetEmissionsFromDistance,
  calculateFleetEmissionsFromFuel,
  calculateLocationBasedScope2Emissions,
  FUEL_EMISSION_FACTORS,
  FLEET_EMISSION_FACTORS,
  REFRIGERANT_GWP_AR5,
  GRID_EMISSION_FACTORS,
} from "@/lib/regulatory/emissions/factors";
import { generateOperationalFootprint } from "@/lib/demo/operational-footprint";

describe("Emission factor calculations", () => {
  describe("calculateFuelEmissions", () => {
    it("calculates diesel combustion emissions correctly", () => {
      // 100 liters diesel × 2.527 kg CO₂e/L = 252.7 kg = 0.2527 tonnes
      const tonnes = calculateFuelEmissions(100, "diesel-liters");
      expect(tonnes).toBeCloseTo(0.2527, 4);
    });

    it("calculates natural gas emissions correctly", () => {
      // 1000 kWh × 0.184 kg CO₂e/kWh = 184 kg = 0.184 tonnes
      const tonnes = calculateFuelEmissions(1000, "natural-gas-kwh");
      expect(tonnes).toBeCloseTo(0.184, 3);
    });

    it("calculates LPG emissions correctly (kg basis)", () => {
      // 50 kg LPG × 2.983 kg CO₂e/kg = 149.15 kg = 0.14915 tonnes
      const tonnes = calculateFuelEmissions(50, "lpg-kg");
      expect(tonnes).toBeCloseTo(0.14915, 5);
    });

    it("handles zero quantity", () => {
      const tonnes = calculateFuelEmissions(0, "diesel-liters");
      expect(tonnes).toBe(0);
    });
  });

  describe("calculateRefrigerantEmissions", () => {
    it("calculates R-410A emissions correctly (high GWP)", () => {
      // 2 kg R-410A × 2088 GWP = 4176 kg CO₂e = 4.176 tonnes
      const tonnes = calculateRefrigerantEmissions(2, "R-410A");
      expect(tonnes).toBeCloseTo(4.176, 3);
    });

    it("calculates R-134a emissions correctly", () => {
      // 1.5 kg R-134a × 1430 GWP = 2145 kg CO₂e = 2.145 tonnes
      const tonnes = calculateRefrigerantEmissions(1.5, "R-134a");
      expect(tonnes).toBeCloseTo(2.145, 3);
    });

    it("calculates R-32 emissions correctly (lower GWP alternative)", () => {
      // 1 kg R-32 × 675 GWP = 675 kg CO₂e = 0.675 tonnes
      const tonnes = calculateRefrigerantEmissions(1, "R-32");
      expect(tonnes).toBeCloseTo(0.675, 3);
    });

    it("calculates natural refrigerant R-744 (CO₂) correctly", () => {
      // 10 kg R-744 × 1 GWP = 10 kg CO₂e = 0.01 tonnes
      const tonnes = calculateRefrigerantEmissions(10, "R-744");
      expect(tonnes).toBeCloseTo(0.01, 3);
    });

    it("handles zero quantity", () => {
      const tonnes = calculateRefrigerantEmissions(0, "R-410A");
      expect(tonnes).toBe(0);
    });
  });

  describe("calculateFleetEmissionsFromDistance", () => {
    it("calculates petrol car emissions correctly", () => {
      // 1000 km × 0.173 kg CO₂e/km = 173 kg = 0.173 tonnes
      const tonnes = calculateFleetEmissionsFromDistance(1000, "car-petrol-distance");
      expect(tonnes).toBeCloseTo(0.173, 3);
    });

    it("calculates motorcycle emissions correctly", () => {
      // 500 km × 0.114 kg CO₂e/km = 57 kg = 0.057 tonnes
      const tonnes = calculateFleetEmissionsFromDistance(500, "motorcycle-petrol-distance");
      expect(tonnes).toBeCloseTo(0.057, 3);
    });

    it("calculates van emissions correctly", () => {
      // 2000 km × 0.267 kg CO₂e/km = 534 kg = 0.534 tonnes
      const tonnes = calculateFleetEmissionsFromDistance(2000, "van-diesel-distance");
      expect(tonnes).toBeCloseTo(0.534, 3);
    });

    it("handles electric vehicle (zero Scope 1 emissions)", () => {
      const tonnes = calculateFleetEmissionsFromDistance(1000, "car-electric-distance");
      expect(tonnes).toBe(0);
    });

    it("throws error for fuel-based factor type", () => {
      expect(() => {
        calculateFleetEmissionsFromDistance(1000, "car-petrol-fuel");
      }).toThrow("does not have distance-based factor");
    });
  });

  describe("calculateFleetEmissionsFromFuel", () => {
    it("calculates emissions from petrol consumption", () => {
      // 100 liters × 2.296 kg CO₂e/L = 229.6 kg = 0.2296 tonnes
      const tonnes = calculateFleetEmissionsFromFuel(100, "car-petrol-fuel");
      expect(tonnes).toBeCloseTo(0.2296, 4);
    });

    it("calculates emissions from diesel consumption", () => {
      // 75 liters × 2.527 kg CO₂e/L = 189.525 kg = 0.189525 tonnes
      const tonnes = calculateFleetEmissionsFromFuel(75, "van-diesel-fuel");
      expect(tonnes).toBeCloseTo(0.189525, 6);
    });

    it("throws error for distance-based factor type", () => {
      expect(() => {
        calculateFleetEmissionsFromFuel(100, "car-petrol-distance");
      }).toThrow("does not have fuel-based factor");
    });
  });

  describe("calculateLocationBasedScope2Emissions (N2.2)", () => {
    it("calculates Nepal grid emissions correctly (very low due to 99.8% hydro)", () => {
      // 10,000 kWh × 0.01 kg CO₂e/kWh = 100 kg = 0.1 tonnes
      const tonnes = calculateLocationBasedScope2Emissions(10000, "nepal-grid");
      expect(tonnes).toBeCloseTo(0.1, 4);
    });

    it("calculates South Asia grid emissions for comparison (coal-heavy)", () => {
      // 10,000 kWh × 0.708 kg CO₂e/kWh = 7,080 kg = 7.08 tonnes
      const tonnes = calculateLocationBasedScope2Emissions(10000, "south-asia-grid");
      expect(tonnes).toBeCloseTo(7.08, 2);
    });

    it("calculates India grid emissions correctly", () => {
      // 10,000 kWh × 0.709 kg CO₂e/kWh = 7,090 kg = 7.09 tonnes
      const tonnes = calculateLocationBasedScope2Emissions(10000, "india-grid");
      expect(tonnes).toBeCloseTo(7.09, 2);
    });

    it("handles zero electricity consumption", () => {
      const tonnes = calculateLocationBasedScope2Emissions(0, "nepal-grid");
      expect(tonnes).toBe(0);
    });

    it("Nepal emissions are ~70x lower than regional average (hydro advantage)", () => {
      const nepalTonnes = calculateLocationBasedScope2Emissions(10000, "nepal-grid");
      const southAsiaTonnes = calculateLocationBasedScope2Emissions(10000, "south-asia-grid");

      expect(southAsiaTonnes / nepalTonnes).toBeGreaterThan(60);
      expect(southAsiaTonnes / nepalTonnes).toBeLessThan(80);
    });
  });
});

describe("Emission factor constants", () => {
  it("FUEL_EMISSION_FACTORS has expected structure", () => {
    expect(FUEL_EMISSION_FACTORS["diesel-liters"]).toMatchObject({
      kgCo2ePerUnit: expect.any(Number),
      unit: "liters",
      source: expect.any(String),
    });
    expect(FUEL_EMISSION_FACTORS["diesel-liters"].source).toContain("DEFRA");
  });

  it("REFRIGERANT_GWP_AR5 has expected structure", () => {
    expect(REFRIGERANT_GWP_AR5["R-410A"]).toMatchObject({
      gwp100: 2088,
      composition: expect.any(String),
      source: "IPCC AR5",
    });
  });

  it("FLEET_EMISSION_FACTORS has both fuel and distance variants", () => {
    expect(FLEET_EMISSION_FACTORS["car-petrol-fuel"]).toMatchObject({
      kgCo2ePerLiter: expect.any(Number),
      source: expect.any(String),
    });
    expect(FLEET_EMISSION_FACTORS["car-petrol-distance"]).toMatchObject({
      kgCo2ePerKm: expect.any(Number),
      source: expect.any(String),
    });
  });

  it("GRID_EMISSION_FACTORS (N2.2) has expected structure", () => {
    expect(GRID_EMISSION_FACTORS["nepal-grid"]).toMatchObject({
      kgCo2ePerKWh: 0.01,
      source: expect.stringContaining("IEA"),
    });
    expect(GRID_EMISSION_FACTORS["nepal-grid"].source).toContain("99.8% hydro");
  });

  it("Nepal grid factor is dramatically lower than regional average (99.8% hydro)", () => {
    const nepal = GRID_EMISSION_FACTORS["nepal-grid"].kgCo2ePerKWh;
    const southAsia = GRID_EMISSION_FACTORS["south-asia-grid"].kgCo2ePerKWh;

    expect(nepal).toBeLessThan(0.02); // Very low due to hydro
    expect(southAsia).toBeGreaterThan(0.7); // Coal-heavy
    expect(southAsia / nepal).toBeGreaterThan(60);
  });
});

describe("generateOperationalFootprint", () => {
  it("generates complete footprint with all categories (Scope 1 + Scope 2)", () => {
    const footprint = generateOperationalFootprint(2024, 25, 20);

    // Structure
    expect(footprint).toMatchObject({
      reportingPeriodStart: "2024-01-01",
      reportingPeriodEnd: "2024-12-31",
      scope1: {
        fuel: expect.any(Array),
        fleet: expect.any(Array),
        refrigerants: expect.any(Array),
        totalCo2eTonnes: expect.any(Number),
        fuelCo2eTonnes: expect.any(Number),
        fleetCo2eTonnes: expect.any(Number),
        refrigerantsCo2eTonnes: expect.any(Number),
      },
      scope2: {
        locationBased: expect.any(Array),
        totalLocationBasedCo2eTonnes: expect.any(Number),
      },
    });

    // Has emissions in all Scope 1 categories
    expect(footprint.scope1.fuel.length).toBeGreaterThan(0);
    expect(footprint.scope1.fleet.length).toBeGreaterThan(0);
    expect(footprint.scope1.refrigerants.length).toBeGreaterThan(0);

    // Has Scope 2 emissions (N2.2)
    expect(footprint.scope2).toBeDefined();
    expect(footprint.scope2!.locationBased.length).toBeGreaterThan(0);
  });

  it("fuel emissions have required fields and valid values", () => {
    const footprint = generateOperationalFootprint(2024, 10, 10);
    const fuelEmission = footprint.scope1.fuel[0];

    expect(fuelEmission).toMatchObject({
      id: expect.stringMatching(/^fuel-\d+$/),
      periodStart: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      periodEnd: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      fuelType: expect.any(String),
      quantity: expect.any(Number),
      unit: expect.any(String),
      emissionFactorKgCo2ePerUnit: expect.any(Number),
      emissionFactorSource: expect.any(String),
      co2eTonnes: expect.any(Number),
    });

    expect(fuelEmission.quantity).toBeGreaterThan(0);
    expect(fuelEmission.co2eTonnes).toBeGreaterThan(0);
    expect(fuelEmission.emissionFactorSource).toContain("DEFRA");
  });

  it("fleet emissions have required fields and valid values", () => {
    const footprint = generateOperationalFootprint(2024, 10, 10);
    const fleetEmission = footprint.scope1.fleet[0];

    expect(fleetEmission).toMatchObject({
      id: expect.stringMatching(/^fleet-\d+$/),
      periodStart: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      periodEnd: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      vehicleType: expect.any(String),
      fuelType: expect.any(String),
      co2eTonnes: expect.any(Number),
    });

    // Should have either distance or fuel consumption
    const hasDistance = fleetEmission.distanceKm !== undefined;
    const hasFuel = fleetEmission.fuelConsumedLiters !== undefined;
    expect(hasDistance || hasFuel).toBe(true);

    expect(fleetEmission.co2eTonnes).toBeGreaterThan(0);
  });

  it("refrigerant emissions have required fields and valid values", () => {
    const footprint = generateOperationalFootprint(2024, 10, 10);
    const refrigEmission = footprint.scope1.refrigerants[0];

    expect(refrigEmission).toMatchObject({
      id: expect.stringMatching(/^refrig-\d+$/),
      periodStart: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      periodEnd: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      refrigerantType: expect.any(String),
      quantityKg: expect.any(Number),
      gwp100: expect.any(Number),
      gwpSource: "IPCC AR5",
      co2eTonnes: expect.any(Number),
      systemType: expect.any(String),
    });

    expect(refrigEmission.quantityKg).toBeGreaterThan(0);
    expect(refrigEmission.gwp100).toBeGreaterThan(0);
    expect(refrigEmission.co2eTonnes).toBeGreaterThan(0);
  });

  it("scope 2 location-based emissions have required fields and valid values (N2.2)", () => {
    const footprint = generateOperationalFootprint(2024, 10, 10);
    expect(footprint.scope2).toBeDefined();

    const scope2Emission = footprint.scope2!.locationBased[0];

    expect(scope2Emission).toMatchObject({
      id: expect.stringMatching(/^scope2-\d+$/),
      periodStart: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      periodEnd: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      electricityConsumedKWh: expect.any(Number),
      gridEmissionFactorKgCo2ePerKWh: expect.any(Number),
      emissionFactorSource: expect.any(String),
      co2eTonnes: expect.any(Number),
      facility: expect.any(String),
      description: expect.any(String),
    });

    expect(scope2Emission.electricityConsumedKWh).toBeGreaterThan(0);
    expect(scope2Emission.gridEmissionFactorKgCo2ePerKWh).toBe(0.01); // Nepal grid
    expect(scope2Emission.emissionFactorSource).toContain("IEA");
    expect(scope2Emission.co2eTonnes).toBeGreaterThan(0);
  });

  it("scope 2 includes quarterly records for head office and all branches (N2.2)", () => {
    const numBranches = 10;
    const footprint = generateOperationalFootprint(2024, numBranches, 10);

    expect(footprint.scope2).toBeDefined();

    // 4 quarters × (1 head office + 10 branches) = 44 records
    const expectedRecords = 4 * (1 + numBranches);
    expect(footprint.scope2!.locationBased.length).toBe(expectedRecords);

    // Check for head office records
    const headOfficeRecords = footprint.scope2!.locationBased.filter(
      (e) => e.facility === "Head Office"
    );
    expect(headOfficeRecords.length).toBe(4); // Q1, Q2, Q3, Q4

    // Check for branch records
    const branchRecords = footprint.scope2!.locationBased.filter((e) =>
      e.facility?.startsWith("Branch")
    );
    expect(branchRecords.length).toBe(numBranches * 4);
  });

  it("head office electricity consumption is higher than branch average (N2.2)", () => {
    const footprint = generateOperationalFootprint(2024, 10, 10);
    expect(footprint.scope2).toBeDefined();

    const headOfficeRecords = footprint.scope2!.locationBased.filter(
      (e) => e.facility === "Head Office"
    );
    const branchRecords = footprint.scope2!.locationBased.filter((e) =>
      e.facility?.startsWith("Branch")
    );

    const avgHeadOfficeKWh =
      headOfficeRecords.reduce((sum, e) => sum + e.electricityConsumedKWh, 0) /
      headOfficeRecords.length;
    const avgBranchKWh =
      branchRecords.reduce((sum, e) => sum + e.electricityConsumedKWh, 0) / branchRecords.length;

    // Head office should use more electricity (servers, HVAC, more staff)
    expect(avgHeadOfficeKWh).toBeGreaterThan(avgBranchKWh);
    expect(avgHeadOfficeKWh).toBeGreaterThan(10000); // 10,000-15,000 kWh per quarter
    expect(avgBranchKWh).toBeGreaterThan(500); // 500-2000 kWh per quarter
    expect(avgBranchKWh).toBeLessThan(2500);
  });

  it("aggregates totals correctly (Scope 1 and Scope 2)", () => {
    const footprint = generateOperationalFootprint(2024, 10, 10);

    // Scope 1: Sum of categories should equal total
    const calculatedScope1Total =
      footprint.scope1.fuelCo2eTonnes +
      footprint.scope1.fleetCo2eTonnes +
      footprint.scope1.refrigerantsCo2eTonnes;

    expect(footprint.scope1.totalCo2eTonnes).toBeCloseTo(calculatedScope1Total, 2);

    // Scope 1 category totals should match sum of individual emissions
    const fuelSum = footprint.scope1.fuel.reduce((sum, e) => sum + e.co2eTonnes, 0);
    const fleetSum = footprint.scope1.fleet.reduce((sum, e) => sum + e.co2eTonnes, 0);
    const refrigSum = footprint.scope1.refrigerants.reduce((sum, e) => sum + e.co2eTonnes, 0);

    expect(footprint.scope1.fuelCo2eTonnes).toBeCloseTo(fuelSum, 2);
    expect(footprint.scope1.fleetCo2eTonnes).toBeCloseTo(fleetSum, 2);
    expect(footprint.scope1.refrigerantsCo2eTonnes).toBeCloseTo(refrigSum, 2);

    // Scope 2 (N2.2): Total should match sum of individual emissions
    expect(footprint.scope2).toBeDefined();
    const scope2Sum = footprint.scope2!.locationBased.reduce((sum, e) => sum + e.co2eTonnes, 0);
    expect(footprint.scope2!.totalLocationBasedCo2eTonnes).toBeCloseTo(scope2Sum, 2);
  });

  it("generates deterministic results for same inputs (Scope 1 and Scope 2)", () => {
    const fp1 = generateOperationalFootprint(2024, 15, 15);
    const fp2 = generateOperationalFootprint(2024, 15, 15);

    // Scope 1 determinism
    expect(fp1.scope1.totalCo2eTonnes).toBe(fp2.scope1.totalCo2eTonnes);
    expect(fp1.scope1.fuel.length).toBe(fp2.scope1.fuel.length);
    expect(fp1.scope1.fleet.length).toBe(fp2.scope1.fleet.length);
    expect(fp1.scope1.refrigerants.length).toBe(fp2.scope1.refrigerants.length);

    // Scope 2 determinism (N2.2)
    expect(fp1.scope2!.totalLocationBasedCo2eTonnes).toBe(
      fp2.scope2!.totalLocationBasedCo2eTonnes
    );
    expect(fp1.scope2!.locationBased.length).toBe(fp2.scope2!.locationBased.length);
  });

  it("scales with number of branches", () => {
    const small = generateOperationalFootprint(2024, 5, 5);
    const large = generateOperationalFootprint(2024, 50, 50);

    // More branches → more emissions
    expect(large.scope1.totalCo2eTonnes).toBeGreaterThan(small.scope1.totalCo2eTonnes);
    expect(large.scope1.fuel.length).toBeGreaterThan(small.scope1.fuel.length);
    expect(large.scope1.refrigerants.length).toBeGreaterThan(small.scope1.refrigerants.length);
  });

  it("handles small bank (1 branch, 1 vehicle)", () => {
    const footprint = generateOperationalFootprint(2024, 1, 1);

    expect(footprint.scope1.totalCo2eTonnes).toBeGreaterThan(0);
    expect(footprint.scope1.fuel.length).toBeGreaterThan(0);
    expect(footprint.scope1.fleet.length).toBeGreaterThan(0);
  });

  it("handles large bank (100 branches, 100 vehicles)", () => {
    const footprint = generateOperationalFootprint(2024, 100, 100);

    expect(footprint.scope1.totalCo2eTonnes).toBeGreaterThan(10); // At least 10 tonnes for large bank
    expect(footprint.scope1.fuel.length).toBeGreaterThan(100);
    expect(footprint.scope1.fleet.length).toBeGreaterThan(100);
  });

  it("different years generate same structure", () => {
    const y2023 = generateOperationalFootprint(2023, 10, 10);
    const y2024 = generateOperationalFootprint(2024, 10, 10);

    expect(y2023.reportingPeriodStart).toBe("2023-01-01");
    expect(y2024.reportingPeriodStart).toBe("2024-01-01");

    // Same structure (counts, categories) across years
    expect(y2023.scope1.fuel.length).toBe(y2024.scope1.fuel.length);
    expect(y2023.scope1.fleet.length).toBe(y2024.scope1.fleet.length);
    expect(y2023.scope1.refrigerants.length).toBe(y2024.scope1.refrigerants.length);

    // Both have positive emissions
    expect(y2023.scope1.totalCo2eTonnes).toBeGreaterThan(0);
    expect(y2024.scope1.totalCo2eTonnes).toBeGreaterThan(0);
  });
});

describe("Realistic emission ranges", () => {
  it("generates realistic total Scope 1 emissions for mid-size bank", () => {
    // Mid-size Nepal bank: 25 branches, 20 vehicles
    // Expected: ~10-150 tonnes CO₂e per year (fuel + fleet + refrigerants)
    // Refrigerants dominate due to high GWP (1000-4000)
    const footprint = generateOperationalFootprint(2024, 25, 20);

    expect(footprint.scope1.totalCo2eTonnes).toBeGreaterThan(5);
    expect(footprint.scope1.totalCo2eTonnes).toBeLessThan(150);
  });

  it("fuel emissions are realistic for Nepal bank operations", () => {
    // Diesel generators + heating should be moderate (Nepal has frequent power cuts)
    const footprint = generateOperationalFootprint(2024, 25, 20);

    expect(footprint.scope1.fuelCo2eTonnes).toBeGreaterThan(1);
    expect(footprint.scope1.fuelCo2eTonnes).toBeLessThan(50);
  });

  it("fleet emissions are realistic for Nepal bank fleet", () => {
    // 20 vehicles (mix of cars, motorcycles, vans) over a year
    const footprint = generateOperationalFootprint(2024, 25, 20);

    expect(footprint.scope1.fleetCo2eTonnes).toBeGreaterThan(2);
    expect(footprint.scope1.fleetCo2eTonnes).toBeLessThan(30);
  });

  it("refrigerant emissions are significant (high GWP)", () => {
    // Refrigerants have very high GWP (1000-4000), so even small leaks matter
    const footprint = generateOperationalFootprint(2024, 25, 20);

    expect(footprint.scope1.refrigerantsCo2eTonnes).toBeGreaterThan(1);
    // Refrigerants often dominate Scope 1 due to high GWP
  });

  it("Scope 2 emissions are VERY low due to Nepal's 99.8% hydro grid (N2.2)", () => {
    // Mid-size Nepal bank: 25 branches
    // Total electricity: ~100,000-200,000 kWh/year
    // Nepal grid: 0.01 kg CO₂e/kWh
    // Expected Scope 2: ~1-2 tonnes CO₂e (extremely low compared to Scope 1)
    const footprint = generateOperationalFootprint(2024, 25, 20);

    expect(footprint.scope2).toBeDefined();
    expect(footprint.scope2!.totalLocationBasedCo2eTonnes).toBeGreaterThan(0.5);
    expect(footprint.scope2!.totalLocationBasedCo2eTonnes).toBeLessThan(3);

    // Scope 2 should be much smaller than Scope 1 (hydro advantage)
    expect(footprint.scope1.totalCo2eTonnes).toBeGreaterThan(
      footprint.scope2!.totalLocationBasedCo2eTonnes * 10
    );
  });

  it("Scope 2 would be ~70x higher if bank were on coal-heavy grid (N2.2 comparison)", () => {
    // This test demonstrates the dramatic difference between Nepal's hydro-heavy grid
    // and the South Asia regional average (coal-heavy)
    // Actual bank uses nepal-grid (0.01 kg/kWh), but if it used south-asia-grid (0.708 kg/kWh),
    // the same electricity consumption would produce ~70x more emissions

    const footprint = generateOperationalFootprint(2024, 25, 20);
    expect(footprint.scope2).toBeDefined();

    // Calculate total kWh consumed
    const totalKWh = footprint.scope2!.locationBased.reduce(
      (sum, e) => sum + e.electricityConsumedKWh,
      0
    );

    // Hypothetical emissions if on South Asia grid
    const hypotheticalSouthAsiaEmissions =
      (totalKWh * GRID_EMISSION_FACTORS["south-asia-grid"].kgCo2ePerKWh) / 1000;

    // Actual emissions are ~70x lower
    expect(hypotheticalSouthAsiaEmissions / footprint.scope2!.totalLocationBasedCo2eTonnes).toBeGreaterThan(60);
    expect(hypotheticalSouthAsiaEmissions / footprint.scope2!.totalLocationBasedCo2eTonnes).toBeLessThan(80);
  });
});

describe("Organizational boundary disaggregation (N2.5)", () => {
  it("Scope 1 includes organizational boundary disaggregation per §29(a)(iv)", () => {
    const footprint = generateOperationalFootprint(2024, 25, 20);

    expect(footprint.scope1.consolidatedGroupCo2eTonnes).toBeDefined();
    expect(footprint.scope1.otherInvesteesCo2eTonnes).toBeDefined();
  });

  it("Scope 1 disaggregation sums to total emissions", () => {
    const footprint = generateOperationalFootprint(2024, 25, 20);

    const consolidatedGroup = footprint.scope1.consolidatedGroupCo2eTonnes ?? 0;
    const otherInvestees = footprint.scope1.otherInvesteesCo2eTonnes ?? 0;
    const calculatedTotal = consolidatedGroup + otherInvestees;

    expect(footprint.scope1.totalCo2eTonnes).toBeCloseTo(calculatedTotal, 3);
  });

  it("Scope 1 demo bank has 100% consolidated group, 0% other investees", () => {
    // First Bank of Nepal (demo) has no associates or joint ventures
    const footprint = generateOperationalFootprint(2024, 25, 20);

    expect(footprint.scope1.consolidatedGroupCo2eTonnes).toBe(footprint.scope1.totalCo2eTonnes);
    expect(footprint.scope1.otherInvesteesCo2eTonnes).toBe(0);
  });

  it("Scope 2 includes organizational boundary disaggregation per §29(a)(iv)", () => {
    const footprint = generateOperationalFootprint(2024, 25, 20);

    expect(footprint.scope2).toBeDefined();
    expect(footprint.scope2!.consolidatedGroupLocationBasedCo2eTonnes).toBeDefined();
    expect(footprint.scope2!.otherInvesteesLocationBasedCo2eTonnes).toBeDefined();
  });

  it("Scope 2 disaggregation sums to total location-based emissions", () => {
    const footprint = generateOperationalFootprint(2024, 25, 20);

    expect(footprint.scope2).toBeDefined();
    const consolidatedGroup = footprint.scope2!.consolidatedGroupLocationBasedCo2eTonnes ?? 0;
    const otherInvestees = footprint.scope2!.otherInvesteesLocationBasedCo2eTonnes ?? 0;
    const calculatedTotal = consolidatedGroup + otherInvestees;

    expect(footprint.scope2!.totalLocationBasedCo2eTonnes).toBeCloseTo(calculatedTotal, 3);
  });

  it("Scope 2 demo bank has 100% consolidated group, 0% other investees", () => {
    // First Bank of Nepal (demo) has no associates or joint ventures
    const footprint = generateOperationalFootprint(2024, 25, 20);

    expect(footprint.scope2).toBeDefined();
    expect(footprint.scope2!.consolidatedGroupLocationBasedCo2eTonnes).toBe(
      footprint.scope2!.totalLocationBasedCo2eTonnes
    );
    expect(footprint.scope2!.otherInvesteesLocationBasedCo2eTonnes).toBe(0);
  });

  it("Organizational boundary disaggregation is deterministic", () => {
    const fp1 = generateOperationalFootprint(2024, 15, 15);
    const fp2 = generateOperationalFootprint(2024, 15, 15);

    // Scope 1
    expect(fp1.scope1.consolidatedGroupCo2eTonnes).toBe(fp2.scope1.consolidatedGroupCo2eTonnes);
    expect(fp1.scope1.otherInvesteesCo2eTonnes).toBe(fp2.scope1.otherInvesteesCo2eTonnes);

    // Scope 2
    expect(fp1.scope2!.consolidatedGroupLocationBasedCo2eTonnes).toBe(
      fp2.scope2!.consolidatedGroupLocationBasedCo2eTonnes
    );
    expect(fp1.scope2!.otherInvesteesLocationBasedCo2eTonnes).toBe(
      fp2.scope2!.otherInvesteesLocationBasedCo2eTonnes
    );
  });

  it("Organizational boundary disaggregation scales with bank size", () => {
    const small = generateOperationalFootprint(2024, 5, 5);
    const large = generateOperationalFootprint(2024, 50, 50);

    // Larger bank → more consolidated group emissions (no investees in either case)
    expect(large.scope1.consolidatedGroupCo2eTonnes!).toBeGreaterThan(
      small.scope1.consolidatedGroupCo2eTonnes!
    );
    expect(large.scope2!.consolidatedGroupLocationBasedCo2eTonnes!).toBeGreaterThan(
      small.scope2!.consolidatedGroupLocationBasedCo2eTonnes!
    );

    // Both have zero investees
    expect(small.scope1.otherInvesteesCo2eTonnes).toBe(0);
    expect(large.scope1.otherInvesteesCo2eTonnes).toBe(0);
    expect(small.scope2!.otherInvesteesLocationBasedCo2eTonnes).toBe(0);
    expect(large.scope2!.otherInvesteesLocationBasedCo2eTonnes).toBe(0);
  });

  it("Arithmetic neutrality: disaggregation does not change total emissions", () => {
    // Generate footprint twice - once before we added disaggregation fields (hypothetically)
    // and once after. The totals should be identical because we only added breakdowns.
    const footprint = generateOperationalFootprint(2024, 25, 20);

    // Scope 1: Total should be unaffected by disaggregation
    const scope1Total = footprint.scope1.totalCo2eTonnes;
    const scope1Disaggregated =
      (footprint.scope1.consolidatedGroupCo2eTonnes ?? 0) +
      (footprint.scope1.otherInvesteesCo2eTonnes ?? 0);

    expect(scope1Total).toBe(scope1Disaggregated);

    // Scope 2: Total should be unaffected by disaggregation
    const scope2Total = footprint.scope2!.totalLocationBasedCo2eTonnes;
    const scope2Disaggregated =
      (footprint.scope2!.consolidatedGroupLocationBasedCo2eTonnes ?? 0) +
      (footprint.scope2!.otherInvesteesLocationBasedCo2eTonnes ?? 0);

    expect(scope2Total).toBe(scope2Disaggregated);
  });
});
