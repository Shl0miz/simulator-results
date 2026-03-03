// lib/compute.test.ts
import { enrichRows, computeMonthlyProfit, parseChargers } from './compute';
import type { SimulationResult } from './types';

const mockRow = (overrides: Partial<SimulationResult> = {}): SimulationResult => ({
  allocator: 'AI',
  chargers: 'DUAL-180:DUAL-180',
  duration_days: 1,
  start_date: '2025-02-28',
  use_transaction_durations: 0.5,
  grid_input: 310,
  profit: 2813,
  total_energy_out: 1298,
  total_energy_in: 798,
  revenue: 2880,
  max_power_demand_1s: 310,
  max_power_demand_15m_rolling: 288,
  max_power_demand_15m_fixed: 273,
  mean_wait_per_driver_rush_hour: 0,
  mean_unmet_rush_hour: 0.1375,
  reneg_events_rush_hour: 0,
  reneg_events: 0,
  mean_utilization: 0.14,
  daily_sessions_per_connector: 8.5,
  num_attempted_sessions: 51,
  num_successful_sessions: 47,
  num_failed_sessions: 4,
  energy_from_storage: 0,
  energy_into_storage: 0,
  sessions_totalEnergy: 28,
  sessions_durationSeconds: 1370,
  sessions_medianPower: 83,
  sessions_unmetDemandRatio: 0.29,
  sessions_energyInFirst10Minutes: 14,
  DX: 75,
  ...overrides,
});

test('enrichRows: AI flag true for AI allocator', () => {
  const enriched = enrichRows([mockRow({ allocator: 'AI' })]);
  expect(enriched[0].AI).toBe(true);
});

test('enrichRows: AI flag false for COM allocator', () => {
  const enriched = enrichRows([mockRow({ allocator: 'COM' })]);
  expect(enriched[0].AI).toBe(false);
});

test('enrichRows: monthKey parsed from start_date', () => {
  const enriched = enrichRows([mockRow({ start_date: '2025-03-15' })]);
  expect(enriched[0].monthKey).toBe('2025-03');
});

test('enrichRows: dx_score from DX field only', () => {
  const enriched = enrichRows([mockRow({ DX: 82 })]);
  expect(enriched[0].dx_score).toBe(82);
});

test('enrichRows: dx_score null when DX absent', () => {
  const row = mockRow();
  delete (row as Partial<SimulationResult>).DX;
  const enriched = enrichRows([row]);
  expect(enriched[0].dx_score).toBeNull();
});

test('enrichRows: _index assigned correctly', () => {
  const enriched = enrichRows([mockRow(), mockRow()]);
  expect(enriched[0]._index).toBe(0);
  expect(enriched[1]._index).toBe(1);
});

test('computeMonthlyProfit: sums profit only when charges OFF', () => {
  const result = computeMonthlyProfit([2000, 3000, 1500], [], { demandChargeRate: 20, applyDemandCharges: false });
  expect(result).toBe(6500);
});

test('computeMonthlyProfit: applies demand charge with max 15m rolling when ON', () => {
  const profits = [2000, 3000];
  const rolling = [250, 300];
  const result = computeMonthlyProfit(profits, rolling, { demandChargeRate: 20, applyDemandCharges: true });
  // 5000 - 20 * 300 = -1000
  expect(result).toBe(-1000);
});

test('computeMonthlyProfit: OFF ignores rolling demand values', () => {
  const result = computeMonthlyProfit([1000], [999], { demandChargeRate: 20, applyDemandCharges: false });
  expect(result).toBe(1000);
});

test('parseChargers: triple same type', () => {
  expect(parseChargers('DUAL-180:DUAL-180:DUAL-180')).toBe('3x Dual-180kW');
});

test('parseChargers: single charger', () => {
  expect(parseChargers('DUAL-180')).toBe('1x Dual-180kW');
});
