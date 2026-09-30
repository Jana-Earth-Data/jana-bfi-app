/**
 * Unit tests for operational footprint aggregation (N2.7).
 * Tests the regulatory aggregation functions moved from lib/demo.
 */

import { describe, it, expect } from "vitest";
import {
  aggregateScope1,
  aggregateScope2,
} from "@/lib/regulatory/operational/aggregation";
import type {
  FuelEmission,
  FleetEmission,
  RefrigerantEmission,
  LocationBasedScope2Emission,
  MarketBasedScope2Emission,
} from "@/lib/types/operational-footprint";

describe("aggregateScope1 (N2.7 - regulatory aggregation)", () => {
  it("aggregates fuel, fleet, and refrigerant emissions correctly", () => {
    const fuel: FuelEmission[] = [
      {
        id: "f1",
        periodStart: "2024-01-01",
        periodEnd: "2024-03-31",
        fuelType: "diesel",
        quantity: 100,
        unit: "liters",
        emissionFactorKgCo2ePerUnit: 2.527,
        emissionFactorSource: "DEFRA 2024",
        co2eTonnes: 0.253, // 100 * 2.527 / 1000
        facility: "Branch 1",
      },
    ];

    const fleet: FleetEmission[] = [
      {
        id: "fl1",
        periodStart: "2024-01-01",
        periodEnd: "2024-03-31",
        vehicleType: "car",
        fuelType: "petrol",
        distanceKm: 1000,
        emissionFactorKgCo2ePerKm: 0.171,
        emissionFactorSource: "DEFRA 2024",
        co2eTonnes: 0.171, // 1000 * 0.171 / 1000
      },
    ];

    const refrigerants: RefrigerantEmission[] = [
      {
        id: "r1",
        periodStart: "2024-06-01",
        periodEnd: "2024-06-30",
        refrigerantType: "R-410A",
        quantityKg: 1.5,
        gwp100: 2088,
        gwpSource: "IPCC AR5",
        co2eTonnes: 3.132, // 1.5 * 2088 / 1000
        facility: "Branch 1",
        systemType: "hvac",
      },
    ];

    const result = aggregateScope1(fuel, fleet, refrigerants);

    expect(result.fuelCo2eTonnes).toBe(0.253);
    expect(result.fleetCo2eTonnes).toBe(0.171);
    expect(result.refrigerantsCo2eTonnes).toBe(3.132);
    expect(result.totalCo2eTonnes).toBe(3.556); // 0.253 + 0.171 + 3.132 = 3.556
    expect(result.fuel).toEqual(fuel);
    expect(result.fleet).toEqual(fleet);
    expect(result.refrigerants).toEqual(refrigerants);
  });

  it("handles empty emission arrays", () => {
    const result = aggregateScope1([], [], []);

    expect(result.fuelCo2eTonnes).toBe(0);
    expect(result.fleetCo2eTonnes).toBe(0);
    expect(result.refrigerantsCo2eTonnes).toBe(0);
    expect(result.totalCo2eTonnes).toBe(0);
    expect(result.consolidatedGroupCo2eTonnes).toBe(0);
    expect(result.otherInvesteesCo2eTonnes).toBe(0);
  });

  it("defaults to 100% consolidated group, 0% other investees when no entities provided (N2.5)", () => {
    const fuel: FuelEmission[] = [
      {
        id: "f1",
        periodStart: "2024-01-01",
        periodEnd: "2024-03-31",
        fuelType: "diesel",
        quantity: 100,
        unit: "liters",
        emissionFactorKgCo2ePerUnit: 2.527,
        emissionFactorSource: "DEFRA 2024",
        co2eTonnes: 0.253,
        facility: "Branch 1",
      },
    ];

    const result = aggregateScope1(fuel, [], []);

    expect(result.totalCo2eTonnes).toBe(0.253);
    // N2.5: Organizational boundary disaggregation defaults to 100% consolidated
    expect(result.consolidatedGroupCo2eTonnes).toBe(0.253);
    expect(result.otherInvesteesCo2eTonnes).toBe(0);
  });

  it("sums multiple emissions in each category correctly", () => {
    const fuel: FuelEmission[] = [
      {
        id: "f1",
        periodStart: "2024-01-01",
        periodEnd: "2024-03-31",
        fuelType: "diesel",
        quantity: 100,
        unit: "liters",
        emissionFactorKgCo2ePerUnit: 2.527,
        emissionFactorSource: "DEFRA 2024",
        co2eTonnes: 0.253,
      },
      {
        id: "f2",
        periodStart: "2024-04-01",
        periodEnd: "2024-06-30",
        fuelType: "lpg",
        quantity: 50,
        unit: "kg",
        emissionFactorKgCo2ePerUnit: 2.983,
        emissionFactorSource: "DEFRA 2024",
        co2eTonnes: 0.149,
      },
    ];

    const fleet: FleetEmission[] = [
      {
        id: "fl1",
        periodStart: "2024-01-01",
        periodEnd: "2024-03-31",
        vehicleType: "car",
        fuelType: "petrol",
        distanceKm: 1000,
        emissionFactorKgCo2ePerKm: 0.171,
        emissionFactorSource: "DEFRA 2024",
        co2eTonnes: 0.171,
      },
      {
        id: "fl2",
        periodStart: "2024-01-01",
        periodEnd: "2024-03-31",
        vehicleType: "motorcycle",
        fuelType: "petrol",
        distanceKm: 500,
        emissionFactorKgCo2ePerKm: 0.084,
        emissionFactorSource: "DEFRA 2024",
        co2eTonnes: 0.042,
      },
    ];

    const result = aggregateScope1(fuel, fleet, []);

    expect(result.fuelCo2eTonnes).toBe(0.402); // 0.253 + 0.149
    expect(result.fleetCo2eTonnes).toBe(0.213); // 0.171 + 0.042
    expect(result.refrigerantsCo2eTonnes).toBe(0);
    expect(result.totalCo2eTonnes).toBe(0.615); // 0.402 + 0.213 + 0
  });

  it("rounds to 3 decimal places (millitonnes precision)", () => {
    const fuel: FuelEmission[] = [
      {
        id: "f1",
        periodStart: "2024-01-01",
        periodEnd: "2024-03-31",
        fuelType: "diesel",
        quantity: 1,
        unit: "liters",
        emissionFactorKgCo2ePerUnit: 2.527,
        emissionFactorSource: "DEFRA 2024",
        co2eTonnes: 0.0025271234567, // More precision than should be kept
      },
    ];

    const result = aggregateScope1(fuel, [], []);

    // Should round each category and total to 3 decimal places
    expect(result.fuelCo2eTonnes).toBe(0.003); // Rounded from 0.0025271234567
    expect(result.totalCo2eTonnes).toBe(0.003);
    expect(result.consolidatedGroupCo2eTonnes).toBe(0.003);
  });

  it("disaggregation fields sum to total (arithmetic check)", () => {
    const fuel: FuelEmission[] = [
      {
        id: "f1",
        periodStart: "2024-01-01",
        periodEnd: "2024-03-31",
        fuelType: "diesel",
        quantity: 100,
        unit: "liters",
        emissionFactorKgCo2ePerUnit: 2.527,
        emissionFactorSource: "DEFRA 2024",
        co2eTonnes: 0.253,
      },
    ];

    const result = aggregateScope1(fuel, [], []);

    // consolidatedGroupCo2eTonnes + otherInvesteesCo2eTonnes should equal totalCo2eTonnes
    const sum =
      (result.consolidatedGroupCo2eTonnes ?? 0) + (result.otherInvesteesCo2eTonnes ?? 0);
    expect(sum).toBe(result.totalCo2eTonnes);
  });
});

describe("aggregateScope2 (N2.7 - regulatory aggregation)", () => {
  it("aggregates location-based emissions correctly", () => {
    const locationBased: LocationBasedScope2Emission[] = [
      {
        id: "s2-1",
        periodStart: "2024-01-01",
        periodEnd: "2024-03-31",
        electricityConsumedKWh: 10000,
        gridEmissionFactorKgCo2ePerKWh: 0.01,
        emissionFactorSource: "Nepal grid factor",
        co2eTonnes: 0.1, // 10000 * 0.01 / 1000
        facility: "Head Office",
      },
    ];

    const result = aggregateScope2(locationBased);

    expect(result.totalLocationBasedCo2eTonnes).toBe(0.1);
    expect(result.locationBased).toEqual(locationBased);
    expect(result.marketBased).toBeUndefined();
    expect(result.totalMarketBasedCo2eTonnes).toBeUndefined();
  });

  it("handles market-based emissions when provided", () => {
    const locationBased: LocationBasedScope2Emission[] = [
      {
        id: "s2-1",
        periodStart: "2024-01-01",
        periodEnd: "2024-03-31",
        electricityConsumedKWh: 10000,
        gridEmissionFactorKgCo2ePerKWh: 0.01,
        emissionFactorSource: "Nepal grid factor",
        co2eTonnes: 0.1,
        facility: "Head Office",
      },
    ];

    const marketBased: MarketBasedScope2Emission[] = [
      {
        id: "s2-mb-1",
        periodStart: "2024-01-01",
        periodEnd: "2024-03-31",
        electricityConsumedKWh: 10000,
        contractualEmissionFactorKgCo2ePerKWh: 0, // Renewable energy certificate
        contractType: "renewable-energy-certificate",
        emissionFactorSource: "REC provider",
        co2eTonnes: 0,
        facility: "Head Office",
      },
    ];

    const result = aggregateScope2(locationBased, marketBased);

    expect(result.totalLocationBasedCo2eTonnes).toBe(0.1);
    expect(result.totalMarketBasedCo2eTonnes).toBe(0);
    expect(result.marketBased).toEqual(marketBased);
  });

  it("defaults to 100% consolidated group, 0% other investees (N2.5)", () => {
    const locationBased: LocationBasedScope2Emission[] = [
      {
        id: "s2-1",
        periodStart: "2024-01-01",
        periodEnd: "2024-03-31",
        electricityConsumedKWh: 10000,
        gridEmissionFactorKgCo2ePerKWh: 0.01,
        emissionFactorSource: "Nepal grid factor",
        co2eTonnes: 0.1,
        facility: "Head Office",
      },
    ];

    const result = aggregateScope2(locationBased);

    // N2.5: Organizational boundary disaggregation defaults to 100% consolidated
    expect(result.consolidatedGroupLocationBasedCo2eTonnes).toBe(0.1);
    expect(result.otherInvesteesLocationBasedCo2eTonnes).toBe(0);
  });

  it("disaggregates market-based emissions when provided (N2.5)", () => {
    const locationBased: LocationBasedScope2Emission[] = [
      {
        id: "s2-1",
        periodStart: "2024-01-01",
        periodEnd: "2024-03-31",
        electricityConsumedKWh: 10000,
        gridEmissionFactorKgCo2ePerKWh: 0.01,
        emissionFactorSource: "Nepal grid factor",
        co2eTonnes: 0.1,
      },
    ];

    const marketBased: MarketBasedScope2Emission[] = [
      {
        id: "s2-mb-1",
        periodStart: "2024-01-01",
        periodEnd: "2024-03-31",
        electricityConsumedKWh: 10000,
        contractualEmissionFactorKgCo2ePerKWh: 0,
        contractType: "renewable-energy-certificate",
        emissionFactorSource: "REC provider",
        co2eTonnes: 0,
      },
    ];

    const result = aggregateScope2(locationBased, marketBased);

    // Both location-based and market-based should be disaggregated
    expect(result.consolidatedGroupLocationBasedCo2eTonnes).toBe(0.1);
    expect(result.otherInvesteesLocationBasedCo2eTonnes).toBe(0);
    expect(result.consolidatedGroupMarketBasedCo2eTonnes).toBe(0);
    expect(result.otherInvesteesMarketBasedCo2eTonnes).toBe(0);
  });

  it("handles empty location-based emissions", () => {
    const result = aggregateScope2([]);

    expect(result.totalLocationBasedCo2eTonnes).toBe(0);
    expect(result.consolidatedGroupLocationBasedCo2eTonnes).toBe(0);
    expect(result.otherInvesteesLocationBasedCo2eTonnes).toBe(0);
  });

  it("sums multiple location-based emissions correctly", () => {
    const locationBased: LocationBasedScope2Emission[] = [
      {
        id: "s2-1",
        periodStart: "2024-01-01",
        periodEnd: "2024-03-31",
        electricityConsumedKWh: 10000,
        gridEmissionFactorKgCo2ePerKWh: 0.01,
        emissionFactorSource: "Nepal grid factor",
        co2eTonnes: 0.1,
        facility: "Head Office",
      },
      {
        id: "s2-2",
        periodStart: "2024-01-01",
        periodEnd: "2024-03-31",
        electricityConsumedKWh: 1000,
        gridEmissionFactorKgCo2ePerKWh: 0.01,
        emissionFactorSource: "Nepal grid factor",
        co2eTonnes: 0.01,
        facility: "Branch 1",
      },
    ];

    const result = aggregateScope2(locationBased);

    expect(result.totalLocationBasedCo2eTonnes).toBe(0.11); // 0.1 + 0.01
  });

  it("rounds to 3 decimal places (millitonnes precision)", () => {
    const locationBased: LocationBasedScope2Emission[] = [
      {
        id: "s2-1",
        periodStart: "2024-01-01",
        periodEnd: "2024-03-31",
        electricityConsumedKWh: 1,
        gridEmissionFactorKgCo2ePerKWh: 0.01,
        emissionFactorSource: "Nepal grid factor",
        co2eTonnes: 0.0000123456789, // More precision than should be kept
      },
    ];

    const result = aggregateScope2(locationBased);

    // Should round to 3 decimal places
    expect(result.totalLocationBasedCo2eTonnes).toBe(0); // Rounds to 0.000 → 0
    expect(result.consolidatedGroupLocationBasedCo2eTonnes).toBe(0);
  });

  it("disaggregation fields sum to total (arithmetic check - location-based)", () => {
    const locationBased: LocationBasedScope2Emission[] = [
      {
        id: "s2-1",
        periodStart: "2024-01-01",
        periodEnd: "2024-03-31",
        electricityConsumedKWh: 10000,
        gridEmissionFactorKgCo2ePerKWh: 0.01,
        emissionFactorSource: "Nepal grid factor",
        co2eTonnes: 0.1,
      },
    ];

    const result = aggregateScope2(locationBased);

    const sum =
      (result.consolidatedGroupLocationBasedCo2eTonnes ?? 0) +
      (result.otherInvesteesLocationBasedCo2eTonnes ?? 0);
    expect(sum).toBe(result.totalLocationBasedCo2eTonnes);
  });

  it("disaggregation fields sum to total (arithmetic check - market-based)", () => {
    const locationBased: LocationBasedScope2Emission[] = [
      {
        id: "s2-1",
        periodStart: "2024-01-01",
        periodEnd: "2024-03-31",
        electricityConsumedKWh: 10000,
        gridEmissionFactorKgCo2ePerKWh: 0.01,
        emissionFactorSource: "Nepal grid factor",
        co2eTonnes: 0.1,
      },
    ];

    const marketBased: MarketBasedScope2Emission[] = [
      {
        id: "s2-mb-1",
        periodStart: "2024-01-01",
        periodEnd: "2024-03-31",
        electricityConsumedKWh: 10000,
        contractualEmissionFactorKgCo2ePerKWh: 0.005,
        contractType: "power-purchase-agreement",
        emissionFactorSource: "PPA",
        co2eTonnes: 0.05,
      },
    ];

    const result = aggregateScope2(locationBased, marketBased);

    const sum =
      (result.consolidatedGroupMarketBasedCo2eTonnes ?? 0) +
      (result.otherInvesteesMarketBasedCo2eTonnes ?? 0);
    expect(sum).toBe(result.totalMarketBasedCo2eTonnes);
  });
});
