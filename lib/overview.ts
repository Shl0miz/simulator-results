// lib/overview.ts
import type { EnrichedRow } from './types';

export function computeOverviewData(rows: EnrichedRow[]) {
  if (rows.length === 0) return null;

  const ai = rows.filter(r => r.AI);
  const noAi = rows.filter(r => !r.AI);
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const sortedByProfit = [...rows].sort((a, b) => b.maximize_profit_score - a.maximize_profit_score);
  const sortedByDx = [...rows].sort((a, b) => (b.maximize_dx_score ?? 0) - (a.maximize_dx_score ?? 0));
  const sortedByAbsProfit = [...rows].sort((a, b) => b.profit - a.profit);

  return {
    totalConfigs: rows.length,
    bestByProfitScore: sortedByProfit[0],
    bestByDxScore: sortedByDx[0],
    highestAbsProfit: sortedByAbsProfit[0],
    top10: sortedByProfit.slice(0, 10),
    aiVsNoAi: {
      deltaProfit: avg(ai.map(r => r.profit)) - avg(noAi.map(r => r.profit)),
      deltaDx: avg(ai.filter(r => r.dx_score != null).map(r => r.dx_score as number))
               - avg(noAi.filter(r => r.dx_score != null).map(r => r.dx_score as number)),
      deltaWait: avg(ai.map(r => r.mean_wait_per_driver_rush_hour))
                 - avg(noAi.map(r => r.mean_wait_per_driver_rush_hour)),
      deltaUnmet: avg(ai.map(r => r.mean_unmet_rush_hour))
                  - avg(noAi.map(r => r.mean_unmet_rush_hour)),
      deltaPeak: avg(ai.map(r => r.max_power_demand_15m_rolling))
                 - avg(noAi.map(r => r.max_power_demand_15m_rolling)),
    },
  };
}
