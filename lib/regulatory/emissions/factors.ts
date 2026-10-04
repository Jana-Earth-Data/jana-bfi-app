/**
 * GHG Emission Factors for Scope 1 and Scope 2
 *
 * Per IFRS S2 B29 (N2.6), an entity shall disclose the emission factors it used in
 * measuring its greenhouse gas emissions, including the source of the emission factors.
 *
 * Per IFRS S2 B22 (N2.6), this registry distinguishes between two types of factors:
 * 1. **CO₂e-basis** (B22 first sentence): Factors already expressed in CO₂ equivalent
 *    using GWP conversion. These are used as-is, with no additional recalculation.
 *    Examples: fuel combustion factors (kg CO₂e/liter), grid factors (kg CO₂e/kWh).
 * 2. **Gas-specific** (B22 second sentence): Factors for specific GHGs (e.g., refrigerant
 *    GWP values) that require GWP₁₀₀ application at computation time to convert kg of
 *    gas → kg CO₂e. Example: R-410A has GWP₁₀₀ = 2,088 (1 kg R-410A = 2,088 kg CO₂e).
 *
 * Each factor carries a `basis` field ("co2e" or "gas-specific") to support this
 * distinction. The EMISSION_FACTOR_REGISTRY at the end of this file provides a
 * comprehensive inventory for B29 disclosure.
 *
 * Sources:
 * - IPCC 2006 Guidelines for National GHG Inventories, Vol. 2 (Energy)
 * - UK DEFRA / BEIS Greenhouse Gas Conversion Factors (2024)
 * - US EPA Emission Factors for Greenhouse Gas Inventories
 * - IPCC Fifth Assessment Report (AR5) - GWP₁₀₀ values
 * - IEA Emissions Factors 2024 (electricity grids)
 *
 * Created for N2.1 (Scope 1 capture), N2.2 (Scope 2), N2.6 (factor registry).
 */

// ---------------------------------------------------------------------------
// Emission factor basis (N2.6 - IFRS S2 B22 compliance)
// ---------------------------------------------------------------------------

/**
 * Emission factor basis per IFRS S2 B22.
 * - "co2e": Factor already expressed in CO₂ equivalent (B22 first sentence exemption).
 *   No GWP recalculation needed. Used as-is.
 * - "gas-specific": Factor is a GWP value for a specific GHG (B22 second sentence).
 *   Requires GWP₁₀₀ multiplication to convert kg of gas → kg CO₂e.
 */
export type EmissionFactorBasis = "co2e" | "gas-specific";

// ---------------------------------------------------------------------------
// Fuel combustion (stationary sources)
// ---------------------------------------------------------------------------

/**
 * Fuel combustion emission factors in kg CO₂e per unit.
 * Source: IPCC 2006 Vol.2 Ch.2 (Stationary Combustion) and DEFRA 2024.
 */
export const FUEL_EMISSION_FACTORS = {
  /**
   * Natural gas combustion.
   * Source: IPCC 2006 Vol.2 Table 2.2 (natural gas, default CO₂ factor 56.1 TJ/Gg,
   * net calorific value 48 TJ/Gg → 0.056 kg CO₂/MJ = 0.201 kg CO₂/kWh).
   * DEFRA 2024 reports 0.18385 kg CO₂e/kWh (gross calorific value).
   */
  "natural-gas-kwh": {
    kgCo2ePerUnit: 0.184, // kg CO₂e per kWh (gross)
    unit: "kWh" as const,
    source: "DEFRA 2024 (natural gas, gross CV)",
    basis: "co2e" as EmissionFactorBasis,
  },
  "natural-gas-m3": {
    kgCo2ePerUnit: 1.849, // kg CO₂e per m³ (approx. 10 kWh/m³ × 0.184)
    unit: "m3" as const,
    source: "DEFRA 2024 (derived from kWh factor)",
    basis: "co2e" as EmissionFactorBasis,
  },

  /**
   * Diesel combustion.
   * Source: DEFRA 2024 average diesel (mineral diesel) 2.527 kg CO₂e/liter.
   * IPCC 2006 Vol.2 Table 2.3 gives 74.1 TJ/Gg CO₂, net CV 43 TJ/Gg → 2.68 kg CO₂/liter.
   */
  "diesel-liters": {
    kgCo2ePerUnit: 2.527, // kg CO₂e per liter
    unit: "liters" as const,
    source: "DEFRA 2024 (average diesel)",
    basis: "co2e" as EmissionFactorBasis,
  },

  /**
   * Petrol (gasoline) combustion.
   * Source: DEFRA 2024 average petrol 2.296 kg CO₂e/liter.
   * IPCC 2006 Vol.2 Table 2.3 gives 69.3 TJ/Gg CO₂, net CV 44.3 TJ/Gg → 2.28 kg CO₂/liter.
   */
  "petrol-liters": {
    kgCo2ePerUnit: 2.296, // kg CO₂e per liter
    unit: "liters" as const,
    source: "DEFRA 2024 (average petrol)",
    basis: "co2e" as EmissionFactorBasis,
  },

  /**
   * Heating oil (fuel oil, kerosene).
   * Source: DEFRA 2024 burning oil (kerosene) 2.534 kg CO₂e/liter.
   */
  "heating-oil-liters": {
    kgCo2ePerUnit: 2.534, // kg CO₂e per liter
    unit: "liters" as const,
    source: "DEFRA 2024 (burning oil/kerosene)",
    basis: "co2e" as EmissionFactorBasis,
  },

  /**
   * Liquefied Petroleum Gas (LPG) combustion.
   * Source: DEFRA 2024 LPG 1.516 kg CO₂e/liter, 2.983 kg CO₂e/kg.
   */
  "lpg-liters": {
    kgCo2ePerUnit: 1.516, // kg CO₂e per liter
    unit: "liters" as const,
    source: "DEFRA 2024 (LPG, liters)",
    basis: "co2e" as EmissionFactorBasis,
  },
  "lpg-kg": {
    kgCo2ePerUnit: 2.983, // kg CO₂e per kg
    unit: "kg" as const,
    source: "DEFRA 2024 (LPG, kg)",
    basis: "co2e" as EmissionFactorBasis,
  },

  /**
   * Coal combustion.
   * Source: IPCC 2006 Vol.2 Table 2.4 (anthracite coal, default 98.3 TJ/Gg CO₂,
   * net CV 26.7 TJ/Gg → 94.6 kg CO₂/GJ = 0.341 kg CO₂/kg coal @ 3.6 MJ/kg).
   * DEFRA 2024 industrial coal 3117.3 kg CO₂e/tonne → 3.117 kg CO₂e/kg.
   */
  "coal-kg": {
    kgCo2ePerUnit: 3.117, // kg CO₂e per kg
    unit: "kg" as const,
    source: "DEFRA 2024 (industrial coal)",
    basis: "co2e" as EmissionFactorBasis,
  },
  "coal-tonnes": {
    kgCo2ePerUnit: 3117.3, // kg CO₂e per tonne
    unit: "tonnes" as const,
    source: "DEFRA 2024 (industrial coal)",
    basis: "co2e" as EmissionFactorBasis,
  },

  /**
   * Biomass combustion.
   * Per IPCC 2006 Vol.2 Ch.2 §2.3.1.4, biomass CO₂ emissions are typically reported
   * separately (not counted as fossil fuel emissions if sustainably sourced). However,
   * non-CO₂ emissions (CH₄, N₂O) from biomass combustion should be included in Scope 1.
   * Source: IPCC default factors for wood/wood waste (Vol.2 Table 2.5).
   * Note: This is a placeholder; actual biomass emissions accounting requires
   * sustainability assessment per GHG Protocol and IFRS guidance.
   */
  "biomass-kg": {
    kgCo2ePerUnit: 0.112, // kg CO₂e per kg (CH₄ + N₂O only, no biogenic CO₂)
    unit: "kg" as const,
    source: "IPCC 2006 Vol.2 Table 2.5 (non-CO₂ emissions from wood)",
    basis: "co2e" as EmissionFactorBasis,
  },
} as const;

// ---------------------------------------------------------------------------
// Fleet (mobile combustion)
// ---------------------------------------------------------------------------

/**
 * Fleet vehicle emission factors.
 * Source: DEFRA 2024 (average passenger cars, LDVs, goods vehicles).
 * Both fuel-based (kg CO₂e/liter) and distance-based (kg CO₂e/km) factors.
 */
export const FLEET_EMISSION_FACTORS = {
  /**
   * Passenger car (average, petrol).
   * Fuel-based: 2.296 kg CO₂e/liter (same as stationary petrol).
   * Distance-based: DEFRA 2024 average petrol car 0.17345 kg CO₂e/km.
   */
  "car-petrol-fuel": {
    kgCo2ePerLiter: 2.296,
    source: "DEFRA 2024 (average petrol)",
    basis: "co2e" as EmissionFactorBasis,
  },
  "car-petrol-distance": {
    kgCo2ePerKm: 0.173, // kg CO₂e per km
    source: "DEFRA 2024 (average petrol car)",
    basis: "co2e" as EmissionFactorBasis,
  },

  /**
   * Passenger car (average, diesel).
   * Fuel-based: 2.527 kg CO₂e/liter (same as stationary diesel).
   * Distance-based: DEFRA 2024 average diesel car 0.16942 kg CO₂e/km.
   */
  "car-diesel-fuel": {
    kgCo2ePerLiter: 2.527,
    source: "DEFRA 2024 (average diesel)",
    basis: "co2e" as EmissionFactorBasis,
  },
  "car-diesel-distance": {
    kgCo2ePerKm: 0.169, // kg CO₂e per km
    source: "DEFRA 2024 (average diesel car)",
    basis: "co2e" as EmissionFactorBasis,
  },

  /**
   * Motorcycle (average, petrol).
   * Smaller engine, lower fuel consumption per km.
   * DEFRA 2024 average motorcycle 0.11371 kg CO₂e/km.
   */
  "motorcycle-petrol-fuel": {
    kgCo2ePerLiter: 2.296, // same as petrol
    source: "DEFRA 2024 (average petrol)",
    basis: "co2e" as EmissionFactorBasis,
  },
  "motorcycle-petrol-distance": {
    kgCo2ePerKm: 0.114, // kg CO₂e per km
    source: "DEFRA 2024 (average motorcycle)",
    basis: "co2e" as EmissionFactorBasis,
  },

  /**
   * Light goods vehicle / van (diesel).
   * DEFRA 2024 average van (up to 3.5 tonnes) 0.26749 kg CO₂e/km.
   */
  "van-diesel-fuel": {
    kgCo2ePerLiter: 2.527,
    source: "DEFRA 2024 (average diesel)",
    basis: "co2e" as EmissionFactorBasis,
  },
  "van-diesel-distance": {
    kgCo2ePerKm: 0.267, // kg CO₂e per km
    source: "DEFRA 2024 (average van, up to 3.5t)",
    basis: "co2e" as EmissionFactorBasis,
  },

  /**
   * Heavy goods vehicle / truck (diesel).
   * DEFRA 2024 average HGV (all) 0.78574 kg CO₂e/km.
   */
  "truck-diesel-fuel": {
    kgCo2ePerLiter: 2.527,
    source: "DEFRA 2024 (average diesel)",
    basis: "co2e" as EmissionFactorBasis,
  },
  "truck-diesel-distance": {
    kgCo2ePerKm: 0.786, // kg CO₂e per km
    source: "DEFRA 2024 (average HGV)",
    basis: "co2e" as EmissionFactorBasis,
  },

  /**
   * Compressed Natural Gas (CNG) vehicle.
   * DEFRA 2024 CNG 0.18669 kg CO₂e/kWh, typical CNG vehicle 0.12 kg CO₂e/km.
   */
  "car-cng-distance": {
    kgCo2ePerKm: 0.12, // kg CO₂e per km (estimated)
    source: "DEFRA 2024 (CNG fuel factor, vehicle estimate)",
    basis: "co2e" as EmissionFactorBasis,
  },

  /**
   * Electric vehicle (no direct Scope 1 emissions).
   * Electricity consumption is Scope 2, not Scope 1.
   * Included for completeness; actual emissions accounted in Scope 2.
   */
  "car-electric-distance": {
    kgCo2ePerKm: 0, // Scope 1 only; Scope 2 handled separately
    source: "N/A (electricity is Scope 2)",
    basis: "co2e" as EmissionFactorBasis,
  },

  /**
   * Hybrid vehicle (petrol).
   * DEFRA 2024 average hybrid car 0.11019 kg CO₂e/km.
   */
  "car-hybrid-distance": {
    kgCo2ePerKm: 0.11, // kg CO₂e per km
    source: "DEFRA 2024 (average hybrid car)",
    basis: "co2e" as EmissionFactorBasis,
  },
} as const;

// ---------------------------------------------------------------------------
// Refrigerants (fugitive emissions)
// ---------------------------------------------------------------------------

/**
 * Global Warming Potential (GWP) values for common refrigerants.
 * Per IFRS S2 B21, use latest IPCC GWP values. Per B22, if refrigerant quantity
 * is measured directly (not pre-converted to CO₂e), apply GWP₁₀₀.
 *
 * Source: IPCC Fifth Assessment Report (AR5) 100-year GWP values.
 * Note: IPCC Sixth Assessment Report (AR6) provides updated values; entities should
 * disclose which IPCC report they use (B21, B29).
 */
export const REFRIGERANT_GWP_AR5 = {
  /**
   * R-410A (HFC blend, common in modern HVAC systems).
   * Composition: R-32 (50%) + R-125 (50%).
   * GWP₁₀₀ = 2,088 (AR5).
   */
  "R-410A": {
    gwp100: 2088,
    composition: "R-32 / R-125 blend (50/50)",
    source: "IPCC AR5",
    basis: "gas-specific" as EmissionFactorBasis,
  },

  /**
   * R-134a (HFC, older HVAC and automotive AC).
   * GWP₁₀₀ = 1,430 (AR5).
   */
  "R-134a": {
    gwp100: 1430,
    composition: "HFC-134a (1,1,1,2-tetrafluoroethane)",
    source: "IPCC AR5",
    basis: "gas-specific" as EmissionFactorBasis,
  },

  /**
   * R-32 (HFC, newer HVAC, lower GWP alternative).
   * GWP₁₀₀ = 675 (AR5).
   */
  "R-32": {
    gwp100: 675,
    composition: "HFC-32 (difluoromethane)",
    source: "IPCC AR5",
    basis: "gas-specific" as EmissionFactorBasis,
  },

  /**
   * R-22 (HCFC, older HVAC, being phased out under Montreal Protocol).
   * GWP₁₀₀ = 1,810 (AR5).
   */
  "R-22": {
    gwp100: 1810,
    composition: "HCFC-22 (chlorodifluoromethane)",
    source: "IPCC AR5",
    basis: "gas-specific" as EmissionFactorBasis,
  },

  /**
   * R-404A (HFC blend, commercial refrigeration).
   * GWP₁₀₀ = 3,922 (AR5).
   */
  "R-404A": {
    gwp100: 3922,
    composition: "R-125 / R-143a / R-134a blend",
    source: "IPCC AR5",
    basis: "gas-specific" as EmissionFactorBasis,
  },

  /**
   * R-407C (HFC blend, HVAC).
   * GWP₁₀₀ = 1,774 (AR5).
   */
  "R-407C": {
    gwp100: 1774,
    composition: "R-32 / R-125 / R-134a blend (23/25/52)",
    source: "IPCC AR5",
    basis: "gas-specific" as EmissionFactorBasis,
  },

  /**
   * R-744 (CO₂, natural refrigerant).
   * GWP₁₀₀ = 1 (by definition).
   */
  "R-744": {
    gwp100: 1,
    composition: "CO₂ (carbon dioxide)",
    source: "IPCC AR5",
    basis: "gas-specific" as EmissionFactorBasis,
  },

  /**
   * R-290 (propane, natural refrigerant).
   * GWP₁₀₀ = 3 (AR5).
   */
  "R-290": {
    gwp100: 3,
    composition: "Propane (C₃H₈)",
    source: "IPCC AR5",
    basis: "gas-specific" as EmissionFactorBasis,
  },
} as const;

// ---------------------------------------------------------------------------
// Scope 2: Electricity grid emission factors (N2.2)
// ---------------------------------------------------------------------------

/**
 * Location-based grid emission factors (kg CO₂e per kWh).
 * Per IFRS S2 B30, location-based method is mandatory for Scope 2.
 *
 * Source: IEA Emissions Factors 2024, national electricity authority data.
 * Nepal grid: 99.8% hydropower, 0.2% solar/wind, virtually no fossil fuels.
 * Direct combustion emissions are essentially zero; small amount from imported
 * electricity from India's coal-heavy grid and T&D losses.
 */
export const GRID_EMISSION_FACTORS = {
  /**
   * Nepal national grid (location-based).
   * Nepal's electricity mix: 99.8% hydro, 0.2% solar/wind (2024).
   * IEA 2024: Direct combustion ~0.0023 gCO2/kWh (essentially zero).
   * Conservative estimate accounts for ~17% imported electricity from India
   * (coal-heavy grid) and 17% T&D losses.
   * Source: IEA Emissions Factors 2024, Nepal Electricity Authority.
   */
  "nepal-grid": {
    kgCo2ePerKWh: 0.01, // kg CO₂e per kWh (very low, mostly hydro)
    source: "IEA 2024 (Nepal grid average, 99.8% hydro + imports)",
    basis: "co2e" as EmissionFactorBasis,
  },

  /**
   * South Asia regional grid average (for comparison).
   * Much higher due to coal-heavy generation in India, Pakistan, Bangladesh.
   * Source: IEA 2024.
   */
  "south-asia-grid": {
    kgCo2ePerKWh: 0.708, // kg CO₂e per kWh (regional average, coal-heavy)
    source: "IEA 2024 (South Asia grid average)",
    basis: "co2e" as EmissionFactorBasis,
  },

  /**
   * India grid (for reference - Nepal imports ~17% from India).
   * Source: IEA 2024.
   */
  "india-grid": {
    kgCo2ePerKWh: 0.709, // kg CO₂e per kWh (coal-dominant grid)
    source: "IEA 2024 (India grid average)",
    basis: "co2e" as EmissionFactorBasis,
  },
} as const;

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Calculate CO₂e tonnes from fuel consumption.
 * @param quantity Fuel quantity consumed
 * @param fuelType Fuel type key from FUEL_EMISSION_FACTORS
 * @returns CO₂e tonnes
 */
export function calculateFuelEmissions(
  quantity: number,
  fuelType: keyof typeof FUEL_EMISSION_FACTORS,
): number {
  const factor = FUEL_EMISSION_FACTORS[fuelType];
  return (quantity * factor.kgCo2ePerUnit) / 1000; // convert kg to tonnes
}

/**
 * Calculate CO₂e tonnes from refrigerant leakage.
 * @param quantityKg Refrigerant quantity in kg
 * @param refrigerantType Refrigerant type key from REFRIGERANT_GWP_AR5
 * @returns CO₂e tonnes
 */
export function calculateRefrigerantEmissions(
  quantityKg: number,
  refrigerantType: keyof typeof REFRIGERANT_GWP_AR5,
): number {
  const gwp = REFRIGERANT_GWP_AR5[refrigerantType].gwp100;
  return (quantityKg * gwp) / 1000; // convert kg CO₂e to tonnes CO₂e
}

/**
 * Calculate CO₂e tonnes from fleet distance traveled.
 * @param distanceKm Distance in kilometers
 * @param vehicleType Vehicle type key from FLEET_EMISSION_FACTORS (distance-based)
 * @returns CO₂e tonnes
 */
export function calculateFleetEmissionsFromDistance(
  distanceKm: number,
  vehicleType: keyof typeof FLEET_EMISSION_FACTORS,
): number {
  const factor = FLEET_EMISSION_FACTORS[vehicleType];
  if (!("kgCo2ePerKm" in factor)) {
    throw new Error(`Vehicle type ${vehicleType} does not have distance-based factor`);
  }
  return (distanceKm * factor.kgCo2ePerKm) / 1000; // convert kg to tonnes
}

/**
 * Calculate CO₂e tonnes from fleet fuel consumption.
 * @param fuelLiters Fuel consumed in liters
 * @param vehicleType Vehicle type key from FLEET_EMISSION_FACTORS (fuel-based)
 * @returns CO₂e tonnes
 */
export function calculateFleetEmissionsFromFuel(
  fuelLiters: number,
  vehicleType: keyof typeof FLEET_EMISSION_FACTORS,
): number {
  const factor = FLEET_EMISSION_FACTORS[vehicleType];
  if (!("kgCo2ePerLiter" in factor)) {
    throw new Error(`Vehicle type ${vehicleType} does not have fuel-based factor`);
  }
  return (fuelLiters * factor.kgCo2ePerLiter) / 1000; // convert kg to tonnes
}

/**
 * Calculate CO₂e tonnes from electricity consumption (location-based Scope 2).
 * @param electricityKWh Electricity consumed in kWh
 * @param gridType Grid type key from GRID_EMISSION_FACTORS
 * @returns CO₂e tonnes
 */
export function calculateLocationBasedScope2Emissions(
  electricityKWh: number,
  gridType: keyof typeof GRID_EMISSION_FACTORS,
): number {
  const factor = GRID_EMISSION_FACTORS[gridType];
  return (electricityKWh * factor.kgCo2ePerKWh) / 1000; // convert kg to tonnes
}

// ---------------------------------------------------------------------------
// Emission factor registry (N2.6 - IFRS S2 B29 compliance)
// ---------------------------------------------------------------------------

/**
 * Comprehensive emission factor registry for IFRS S2 B29 disclosure.
 *
 * Per IFRS S2 §B29, an entity shall disclose the emission factors used in
 * measuring GHG emissions, including their source. This registry consolidates
 * all factors in the module with their metadata.
 *
 * Per IFRS S2 §B22 (N2.6), factors are categorized by basis:
 * - **CO₂e-basis** (B22 first sentence): Factors already in CO₂ equivalent.
 *   These are used as-is, with no additional GWP recalculation. Examples:
 *   fuel combustion (kg CO₂e/liter), grid factors (kg CO₂e/kWh).
 * - **Gas-specific** (B22 second sentence): GWP values for specific GHGs.
 *   These require GWP₁₀₀ multiplication at computation time (kg gas → kg CO₂e).
 *   Example: R-410A has GWP₁₀₀ = 2,088 (1 kg R-410A = 2,088 kg CO₂e).
 *
 * This registry supports B29 disclosure requirements and provides full
 * traceability of emission factors to their authoritative sources.
 */
export const EMISSION_FACTOR_REGISTRY = {
  /**
   * Scope 1: Fuel combustion (stationary sources).
   * All factors are CO₂e-basis per DEFRA 2024 and IPCC 2006.
   * Activity: Stationary combustion in owned/controlled sources.
   */
  fuel: {
    factors: FUEL_EMISSION_FACTORS,
    scope: "Scope 1" as const,
    category: "Stationary combustion (fuel)" as const,
    basis: "co2e" as const,
    sources: ["DEFRA 2024", "IPCC 2006 Vol.2 Ch.2"] as const,
    unit: "kg CO₂e per unit of fuel (kWh, m³, liters, kg, tonnes)" as const,
  },

  /**
   * Scope 1: Fleet (mobile combustion).
   * All factors are CO₂e-basis per DEFRA 2024.
   * Activity: Mobile combustion in owned/controlled vehicles.
   */
  fleet: {
    factors: FLEET_EMISSION_FACTORS,
    scope: "Scope 1" as const,
    category: "Mobile combustion (fleet)" as const,
    basis: "co2e" as const,
    sources: ["DEFRA 2024"] as const,
    unit: "kg CO₂e per liter (fuel-based) or per km (distance-based)" as const,
  },

  /**
   * Scope 1: Refrigerants (fugitive emissions).
   * All factors are gas-specific GWP₁₀₀ values per IPCC AR5.
   * Activity: Fugitive emissions from refrigerant leaks/recharges.
   * NOTE: These are GWP values, not CO₂e factors. Computation requires
   * multiplication: kg refrigerant × GWP₁₀₀ = kg CO₂e (then ÷1000 for tonnes).
   */
  refrigerants: {
    factors: REFRIGERANT_GWP_AR5,
    scope: "Scope 1" as const,
    category: "Fugitive emissions (refrigerants)" as const,
    basis: "gas-specific" as const,
    sources: ["IPCC AR5"] as const,
    unit: "GWP₁₀₀ (100-year Global Warming Potential)" as const,
  },

  /**
   * Scope 2: Electricity grid (location-based).
   * All factors are CO₂e-basis per IEA 2024.
   * Activity: Purchased electricity (location-based method, mandatory per B30).
   * Per IFRS S2 B30, location-based method is mandatory; market-based is
   * optional where contractual instruments exist.
   */
  grid: {
    factors: GRID_EMISSION_FACTORS,
    scope: "Scope 2" as const,
    category: "Purchased electricity (location-based)" as const,
    basis: "co2e" as const,
    sources: ["IEA 2024", "Nepal Electricity Authority"] as const,
    unit: "kg CO₂e per kWh" as const,
  },
} as const;
