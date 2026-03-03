// app/dashboard/page.tsx
'use client';
import { useSimulationStore } from '@/store/simulationStore';
import { computeOverviewData } from '@/lib/overview';
import { KPICard } from '@/components/KPICard';
import { ScoreBar } from '@/components/ScoreBar';
import { AllocatorBadge } from '@/components/AllocatorBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatKw, formatScore } from '@/lib/utils';

export default function OverviewPage() {
  const rows = useSimulationStore(s => s.rawRows);
  const data = computeOverviewData(rows);

  if (!data) {
    return <div className="text-slate-400">No data loaded.</div>;
  }

  const { bestByProfitScore, bestByDxScore, highestAbsProfit, top10, aiVsNoAi } = data;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h2 className="text-xl font-bold text-white">Overview</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          title="Configurations"
          value={data.totalConfigs}
          subtitle="loaded"
        />
        <KPICard
          title="Best by Profit Score"
          value={formatScore(bestByProfitScore.maximize_profit_score)}
          subtitle={bestByProfitScore.name}
        />
        <KPICard
          title="Best by DX Score"
          value={formatScore(bestByDxScore.maximize_dx_score)}
          subtitle={bestByDxScore.name}
        />
        <KPICard
          title="Highest Profit"
          value={formatCurrency(highestAbsProfit.profit)}
          subtitle={highestAbsProfit.name}
        />
      </div>

      {/* AI vs No-AI deltas */}
      <Card className="border-slate-700" style={{ background: 'oklch(0.13 0.03 265)' }}>
        <CardHeader>
          <CardTitle className="text-sm text-slate-300">AI vs No-AI — Average Delta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            {[
              { label: 'Profit',      value: aiVsNoAi.deltaProfit,  fmt: (v: number) => formatCurrency(v),               lowerBetter: false },
              { label: 'DX Score',    value: aiVsNoAi.deltaDx,      fmt: (v: number) => v.toFixed(1),                     lowerBetter: false },
              { label: 'Wait (Rush)', value: aiVsNoAi.deltaWait,    fmt: (v: number) => v.toFixed(2) + ' min',            lowerBetter: true  },
              { label: 'Unmet',       value: aiVsNoAi.deltaUnmet,   fmt: (v: number) => (v * 100).toFixed(2) + '%',       lowerBetter: true  },
              { label: 'Peak Power',  value: aiVsNoAi.deltaPeak,    fmt: (v: number) => formatKw(v),                     lowerBetter: true  },
            ].map(({ label, value, fmt, lowerBetter }) => {
              const isGood = lowerBetter ? value <= 0 : value >= 0;
              return (
                <div key={label} className="text-center">
                  <p className="text-xs text-slate-400 mb-1">{label}</p>
                  <p className={`text-lg font-bold ${isGood ? 'text-green-400' : 'text-red-400'}`}>
                    {value >= 0 ? '+' : ''}{fmt(value)}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top 10 */}
      <Card className="border-slate-700" style={{ background: 'oklch(0.13 0.03 265)' }}>
        <CardHeader>
          <CardTitle className="text-sm text-slate-300">Top 10 by Profit Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {top10.map((row, i) => (
              <div key={row._index} className="flex items-center gap-3 py-2 border-b border-slate-800 last:border-0">
                <span className="w-6 text-xs text-slate-500 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{row.name}</p>
                  <div className="flex gap-4 mt-1">
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 mb-0.5">Profit Score</p>
                      <ScoreBar value={row.maximize_profit_score} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 mb-0.5">DX Score</p>
                      <ScoreBar value={row.dx_score} />
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-white">{formatCurrency(row.profit)}</p>
                  <AllocatorBadge allocator={row.allocator} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
