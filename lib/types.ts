// lib/types.ts

/** Raw row as returned by the simulation API */
export interface SimulationResult {
  // Identifiers
  allocator: string;           // "AI" | "COM" | "NOCHECKS"
  chargers: string;            // e.g. "DUAL-180:DUAL-180:DUAL-180"
  duration_days: number;       // load multiplier, 1.0 = 100%
  start_date: string;          // "YYYY-MM-DD"
  use_transaction_durations: number;
  grid_input: number;          // kW
  BTM_name?: string;           // BESS config name
  site_name?: string;

  // Performance
  profit: number;
  total_energy_out: number;
  total_energy_in: number;
  revenue: number;
  max_power_demand_1s: number;
  max_power_demand_15m_rolling: number;
  max_power_demand_15m_fixed: number;

  // Driver experience (from API only)
  DX?: number;                 // dx_score — never computed locally
  mean_wait_per_driver_rush_hour: number;
  mean_unmet_rush_hour: number;
  reneg_events_rush_hour: number;
  reneg_events: number;

  // Utilization
  mean_utilization: number;
  daily_sessions_per_connector: number;
  num_attempted_sessions: number;
  num_successful_sessions: number;
  num_failed_sessions: number;

  // Storage
  energy_from_storage: number;
  energy_into_storage: number;

  // Sessions stats
  sessions_totalEnergy: number;
  sessions_durationSeconds: number;
  sessions_medianPower: number;
  sessions_unmetDemandRatio: number;
  sessions_energyInFirst10Minutes: number;

  // DCO
  demand_charge_optimizer_power_limit_kW?: number;

  // Allow additional fields from API
  [key: string]: unknown;
}

/** Row after enrichment */
export interface EnrichedRow extends SimulationResult {
  // Computed identifiers
  _index: number;
  name: string;               // human-readable label
  AI: boolean;
  DCO: boolean;
  loadPercent: number;        // duration_days * 100
  monthKey: string;           // "YYYY-MM"

  // Scores (profit_score requires all rows for normalization)
  dx_score: number | null;    // from API DX field only
  profit_score: number;       // MinMax normalized 0-100
  maximize_profit_score: number; // 70% profit + 30% dx
  maximize_dx_score: number;     // 30% profit + 70% dx
}

/** Global settings from sidebar */
export interface GlobalSettings {
  demandChargeRate: number;   // $/kW, default 20
  applyDemandCharges: boolean; // default false
}

/** Flexible API config — loaded from config/api.config.json at runtime */
export interface ApiConfig {
  baseUrl: string;
  endpoint: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  /** JSONPath-style dot-notation to the results array, e.g. "data.results" */
  resultsPath?: string;
  /** Field mapping overrides, e.g. { dx_score: "DX" } */
  fieldMap?: Record<string, string>;
}
