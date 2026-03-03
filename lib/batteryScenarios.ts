// lib/batteryScenarios.ts
import type { EnrichedRow, GlobalSettings } from './types';
import { computeMonthlyProfit } from './compute';
import { SCENARIO_COLORS } from '@/constants';

export interface BatteryScenario {
  id: string;
  btmName: string;
  label: string;
  color: string;
  rows: EnrichedRow[];
  avgProfit: number;
  avgDx: number | null;
  monthlyProfit: number;
  totalEnergy: number;
  energyFromStorage: number;
  energyIntoStorage: number;
}

export function buildBatteryScenarios(rows: EnrichedRow[], settings: GlobalSettings): BatteryScenario[] {
  const aiRows = rows.filter(r => r.AI && r.BTM_name);
  const byBtm: Record<string, EnrichedRow[]> = {};
  aiRows.forEach(r => { (byBtm[r.BTM_name as string] ??= []).push(r); });

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  return Object.entries(byBtm).map(([btmName, scenarioRows], i) => {
    const byMonth: Record<string, EnrichedRow[]> = {};
    scenarioRows.forEach(r => { (byMonth[r.monthKey] ??= []).push(r); });

    const monthlyProfits = Object.values(byMonth).map(mRows =>
      computeMonthlyProfit(
        mRows.map(r => r.profit),
        mRows.map(r => r.max_power_demand_15m_rolling),
        settings
      )
    );
    const monthlyProfit = monthlyProfits.length
      ? monthlyProfits.reduce((a, b) => a + b, 0) / monthlyProfits.length
      : 0;

    const dxScores = scenarioRows.map(r => r.dx_score).filter((v): v is number => v !== null);

    return {
      id: btmName,
      btmName,
      label: btmName,
      color: SCENARIO_COLORS[i % SCENARIO_COLORS.length],
      rows: scenarioRows,
      avgProfit: avg(scenarioRows.map(r => r.profit)),
      avgDx: dxScores.length ? avg(dxScores) : null,
      monthlyProfit,
      totalEnergy: scenarioRows.reduce((s, r) => s + r.total_energy_out, 0),
      energyFromStorage: avg(scenarioRows.map(r => r.energy_from_storage)),
      energyIntoStorage: avg(scenarioRows.map(r => r.energy_into_storage)),
    };
  });
}
