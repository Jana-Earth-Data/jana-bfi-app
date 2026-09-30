/**
 * Unit tests for bank operational footprint (Scope 1 emissions).
 * Tests emission factor calculations, demo seeding, and aggregation.
 *
 * Created for N2.1.
 */

import { describe, it, expect } from "vitest";
import {
  calculateFuelEmissions,
  calculateRefrigerantEmissions,
  calculateFleetEmissionsFromDistance,
  calculateFleetEmissionsFromFuel,
  FUEL_EMISSION_FACTORS,
  FLEET_EMISSION_FACTORS,
  REFRIGERANT_GWP_AR5,
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
});

describe("generateOperationalFootprint", () => {
  it("generates complete footprint with all categories", () => {
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
    });

    // Has emissions in all categories
    expect(footprint.scope1.fuel.length).toBeGreaterThan(0);
    expect(footprint.scope1.fleet.length).toBeGreaterThan(0);
    expect(footprint.scope1.refrigerants.length).toBeGreaterThan(0);
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

  it("aggregates totals correctly", () => {
    const footprint = generateOperationalFootprint(2024, 10, 10);

    // Sum of categories should equal total
    const calculatedTotal =
      footprint.scope1.fuelCo2eTonnes +
      footprint.scope1.fleetCo2eTonnes +
      footprint.scope1.refrigerantsCo2eTonnes;

    expect(footprint.scope1.totalCo2eTonnes).toBeCloseTo(calculatedTotal, 2);

    // Category totals should match sum of individual emissions
    const fuelSum = footprint.scope1.fuel.reduce((sum, e) => sum + e.co2eTonnes, 0);
    const fleetSum = footprint.scope1.fleet.reduce((sum, e) => sum + e.co2eTonnes, 0);
    const refrigSum = footprint.scope1.refrigerants.reduce((sum, e) => sum + e.co2eTonnes, 0);

    expect(footprint.scope1.fuelCo2eTonnes).toBeCloseTo(fuelSum, 2);
    expect(footprint.scope1.fleetCo2eTonnes).toBeCloseTo(fleetSum, 2);
    expect(footprint.scope1.refrigerantsCo2eTonnes).toBeCloseTo(refrigSum, 2);
  });

  it("generates deterministic results for same inputs", () => {
    const fp1 = generateOperationalFootprint(2024, 15, 15);
    const fp2 = generateOperationalFootprint(2024, 15, 15);

    expect(fp1.scope1.totalCo2eTonnes).toBe(fp2.scope1.totalCo2eTonnes);
    expect(fp1.scope1.fuel.length).toBe(fp2.scope1.fuel.length);
    expect(fp1.scope1.fleet.length).toBe(fp2.scope1.fleet.length);
    expect(fp1.scope1.refrigerants.length).toBe(fp2.scope1.refrigerants.length);
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
});
