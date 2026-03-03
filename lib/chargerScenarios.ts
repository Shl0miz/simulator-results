// lib/chargerScenarios.ts
import type { EnrichedRow, GlobalSettings } from './types';
import { computeMonthlyProfit, parseChargers } from './compute';
import { SCENARIO_COLORS } from '@/constants';

export interface ChargerScenario {
  id: string;
  rawChargers: string;
  label: string;
  color: string;
  rows: EnrichedRow[];
  avgProfit: number;
  avgDx: number | null;
  monthlyProfit: number;
  totalEnergy: number;
}

export function buildChargerScenarios(rows: EnrichedRow[], settings: GlobalSettings): ChargerScenario[] {
  const aiRows = rows.filter(r => r.AI);
  const byCharger: Record<string, EnrichedRow[]> = {};
  aiRows.forEach(r => { (byCharger[r.chargers] ??= []).push(r); });

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  return Object.entries(byCharger).map(([chargers, scenarioRows], i) => {
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
    const label = parseChargers(chargers);

    return {
      id: chargers,
      rawChargers: chargers,
      label,
      color: SCENARIO_COLORS[i % SCENARIO_COLORS.length],
      rows: scenarioRows,
      avgProfit: avg(scenarioRows.map(r => r.profit)),
      avgDx: dxScores.length ? avg(dxScores) : null,
      monthlyProfit,
      totalEnergy: scenarioRows.reduce((s, r) => s + r.total_energy_out, 0),
    };
  });
}
