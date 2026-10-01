-- ============================================================================
-- Operational Footprint Capture Tables (N2.8)
-- ============================================================================
-- Bank's own Scope 1 and Scope 2 operational emissions.
-- Four tables for the four emission types:
--   - Fuel combustion (stationary)
--   - Fleet vehicles (mobile)
--   - Refrigerants (fugitive)
--   - Electricity (Scope 2 location-based)
--
-- All tables share the same structure pattern: scoped by bank_id, attributed
-- to an officer, with a reporting period and emission calculation details.
--
-- Market-based Scope 2 is optional per IFRS S2 B31 and only populated where
-- contractual instruments (RECs, PPAs) exist. Not included in initial schema.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Scope 1: Fuel combustion (stationary)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.bfi_operational_fuel CASCADE;
CREATE TABLE public.bfi_operational_fuel (
    id                              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id                         text        NOT NULL REFERENCES public.bfi_banks(id) ON DELETE CASCADE,
    officer_id                      text        NOT NULL REFERENCES public.bfi_officers(id),

    -- Reporting period
    period_start                    date        NOT NULL,
    period_end                      date        NOT NULL,

    -- Fuel consumption
    fuel_type                       text        NOT NULL,        -- e.g. "diesel", "natural-gas", "lpg"
    quantity                        numeric     NOT NULL CHECK (quantity >= 0),
    unit                            text        NOT NULL,        -- e.g. "liters", "kWh", "m3", "kg", "tonnes"
    facility                        text,                        -- e.g. "Head Office", "Branch 3"

    -- Emission factor (from lib/regulatory/emissions/factors.ts or officer-provided)
    emission_factor_kg_co2e_per_unit numeric    NOT NULL CHECK (emission_factor_kg_co2e_per_unit >= 0),
    emission_factor_source          text        NOT NULL,        -- e.g. "DEFRA 2024", "IPCC 2006"

    -- Computed emissions (quantity * factor / 1000)
    co2e_tonnes                     numeric     NOT NULL CHECK (co2e_tonnes >= 0),

    -- Optional fields
    notes                           text,
    evidence_url                    text,                        -- S3/Supabase Storage URL for supporting document

    -- Audit trail
    captured_at                     timestamptz NOT NULL DEFAULT now(),
    updated_at                      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bfi_operational_fuel_bank_idx ON public.bfi_operational_fuel (bank_id);
CREATE INDEX bfi_operational_fuel_period_idx ON public.bfi_operational_fuel (bank_id, period_start, period_end);


-- ---------------------------------------------------------------------------
-- Scope 1: Fleet vehicles (mobile combustion)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.bfi_operational_fleet CASCADE;
CREATE TABLE public.bfi_operational_fleet (
    id                              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id                         text        NOT NULL REFERENCES public.bfi_banks(id) ON DELETE CASCADE,
    officer_id                      text        NOT NULL REFERENCES public.bfi_officers(id),

    -- Reporting period
    period_start                    date        NOT NULL,
    period_end                      date        NOT NULL,

    -- Vehicle and fuel
    vehicle_type                    text        NOT NULL,        -- e.g. "car", "motorcycle", "van", "truck"
    fuel_type                       text        NOT NULL,        -- e.g. "petrol", "diesel", "cng"
    vehicle_id                      text,                        -- e.g. "Vehicle 3", "Car XYZ-1234"

    -- Activity data (either distance-based or fuel-based)
    distance_km                     numeric     CHECK (distance_km >= 0),
    fuel_consumed_liters            numeric     CHECK (fuel_consumed_liters >= 0),

    -- Emission factor (one of these will be populated based on method)
    emission_factor_kg_co2e_per_km  numeric     CHECK (emission_factor_kg_co2e_per_km >= 0),
    emission_factor_kg_co2e_per_liter numeric   CHECK (emission_factor_kg_co2e_per_liter >= 0),
    emission_factor_source          text        NOT NULL,

    -- Computed emissions
    co2e_tonnes                     numeric     NOT NULL CHECK (co2e_tonnes >= 0),

    -- Optional fields
    notes                           text,
    evidence_url                    text,

    -- Audit trail
    captured_at                     timestamptz NOT NULL DEFAULT now(),
    updated_at                      timestamptz NOT NULL DEFAULT now(),

    -- Constraint: must have either distance OR fuel consumption (not both, not neither)
    CONSTRAINT fleet_has_activity_data CHECK (
        (distance_km IS NOT NULL AND fuel_consumed_liters IS NULL) OR
        (distance_km IS NULL AND fuel_consumed_liters IS NOT NULL)
    ),
    CONSTRAINT fleet_has_matching_factor CHECK (
        (distance_km IS NOT NULL AND emission_factor_kg_co2e_per_km IS NOT NULL) OR
        (fuel_consumed_liters IS NOT NULL AND emission_factor_kg_co2e_per_liter IS NOT NULL)
    )
);

CREATE INDEX bfi_operational_fleet_bank_idx ON public.bfi_operational_fleet (bank_id);
CREATE INDEX bfi_operational_fleet_period_idx ON public.bfi_operational_fleet (bank_id, period_start, period_end);


-- ---------------------------------------------------------------------------
-- Scope 1: Refrigerants (fugitive emissions)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.bfi_operational_refrigerants CASCADE;
CREATE TABLE public.bfi_operational_refrigerants (
    id                              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id                         text        NOT NULL REFERENCES public.bfi_banks(id) ON DELETE CASCADE,
    officer_id                      text        NOT NULL REFERENCES public.bfi_officers(id),

    -- Reporting period
    period_start                    date        NOT NULL,
    period_end                      date        NOT NULL,

    -- Refrigerant details
    refrigerant_type                text        NOT NULL,        -- e.g. "R-410A", "R-134a", "R-32"
    quantity_kg                     numeric     NOT NULL CHECK (quantity_kg >= 0),
    facility                        text,                        -- e.g. "Head Office HVAC", "Branch 5"
    system_type                     text,                        -- e.g. "hvac", "refrigeration", "chiller"
    event_type                      text,                        -- e.g. "annual-servicing", "leak-repair", "recharge"

    -- GWP (Global Warming Potential from IPCC AR5/AR6)
    gwp_100                         numeric     NOT NULL CHECK (gwp_100 > 0),
    gwp_source                      text        NOT NULL,        -- e.g. "IPCC AR5", "IPCC AR6"

    -- Computed emissions (quantity_kg * gwp_100 / 1000)
    co2e_tonnes                     numeric     NOT NULL CHECK (co2e_tonnes >= 0),

    -- Optional fields
    notes                           text,
    evidence_url                    text,

    -- Audit trail
    captured_at                     timestamptz NOT NULL DEFAULT now(),
    updated_at                      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bfi_operational_refrigerants_bank_idx ON public.bfi_operational_refrigerants (bank_id);
CREATE INDEX bfi_operational_refrigerants_period_idx ON public.bfi_operational_refrigerants (bank_id, period_start, period_end);


-- ---------------------------------------------------------------------------
-- Scope 2: Electricity (location-based method, mandatory per IFRS S2 B30)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.bfi_operational_electricity CASCADE;
CREATE TABLE public.bfi_operational_electricity (
    id                                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id                             text        NOT NULL REFERENCES public.bfi_banks(id) ON DELETE CASCADE,
    officer_id                          text        NOT NULL REFERENCES public.bfi_officers(id),

    -- Reporting period
    period_start                        date        NOT NULL,
    period_end                          date        NOT NULL,

    -- Electricity consumption
    electricity_consumed_kwh            numeric     NOT NULL CHECK (electricity_consumed_kwh >= 0),
    facility                            text,                        -- e.g. "Head Office", "Branch 10"
    meter_number                        text,                        -- Optional utility meter reference

    -- Grid emission factor (location-based)
    grid_emission_factor_kg_co2e_per_kwh numeric    NOT NULL CHECK (grid_emission_factor_kg_co2e_per_kwh >= 0),
    emission_factor_source              text        NOT NULL,        -- e.g. "IEA 2024", "Nepal Electricity Authority"
    grid_region                         text,                        -- e.g. "Nepal", "India", "South Asia"

    -- Computed emissions (electricity_consumed_kwh * grid_factor / 1000)
    co2e_tonnes                         numeric     NOT NULL CHECK (co2e_tonnes >= 0),

    -- Optional fields
    notes                               text,
    evidence_url                        text,                        -- Utility bill, meter reading

    -- Audit trail
    captured_at                         timestamptz NOT NULL DEFAULT now(),
    updated_at                          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bfi_operational_electricity_bank_idx ON public.bfi_operational_electricity (bank_id);
CREATE INDEX bfi_operational_electricity_period_idx ON public.bfi_operational_electricity (bank_id, period_start, period_end);
