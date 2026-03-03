// lib/compute.ts
import type { SimulationResult, EnrichedRow, GlobalSettings } from './types';

export function computeMonthlyProfit(
  profits: number[],
  rollingDemands: number[],
  settings: GlobalSettings
): number {
  const totalProfit = profits.reduce((sum, p) => sum + p, 0);
  if (!settings.applyDemandCharges || rollingDemands.length === 0) {
    return totalProfit;
  }
  const peakDemand = Math.max(...rollingDemands);
  return totalProfit - settings.demandChargeRate * peakDemand;
}

function minMax(values: number[]): (v: number) => number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return () => 100;
  return (v: number) => ((v - min) / (max - min)) * 100;
}

export function enrichRows(rows: SimulationResult[]): EnrichedRow[] {
  const profits = rows.map(r => r.profit);
  const normProfit = minMax(profits);

  return rows.map((row, i): EnrichedRow => {
    const AI = row.allocator === 'AI';
    const DCO = row.demand_charge_optimizer_power_limit_kW != null &&
                row.demand_charge_optimizer_power_limit_kW > 0;
    const loadPercent = Math.round(row.duration_days * 100);
    const monthKey = row.start_date.slice(0, 7);

    const dx_score = (row.DX != null) ? row.DX : null;
    const profit_score = normProfit(row.profit);

    const maximize_profit_score = dx_score != null
      ? 0.7 * profit_score + 0.3 * dx_score
      : profit_score;

    const maximize_dx_score = dx_score != null
      ? 0.3 * profit_score + 0.7 * dx_score
      : profit_score;

    const chargerLabel = parseChargers(row.chargers);
    const name = `${row.allocator} | ${chargerLabel} | ${loadPercent}% | ${row.grid_input}kW`;

    return {
      ...row,
      _index: i,
      name,
      AI,
      DCO,
      loadPercent,
      monthKey,
      dx_score,
      profit_score,
      maximize_profit_score,
      maximize_dx_score,
    };
  });
}

/** "DUAL-180:DUAL-180:DUAL-180" -> "3x Dual-180kW" */
export function parseChargers(chargers: string): string {
  if (!chargers) return 'Unknown';
  const parts = chargers.split(':');
  const counts: Record<string, number> = {};
  for (const p of parts) {
    counts[p] = (counts[p] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([type, count]) => {
      const readable = type.replace('DUAL-', 'Dual-').replace('SINGLE-', 'Single-') + 'kW';
      return `${count}x ${readable}`;
    })
    .join(' + ');
}
