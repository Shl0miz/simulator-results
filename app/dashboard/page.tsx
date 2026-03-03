// app/dashboard/page.tsx
'use client';
import { useSimulationStore } from '@/store/simulationStore';
import { computeOverviewData } from '@/lib/overview';
import { KPICard } from '@/components/KPICard';
import { ScoreBar } from '@/components/ScoreBar';
import { AllocatorBadge } from '@/components/AllocatorBadge';
import { formatCurrency, formatKw, formatScore } from '@/lib/utils';

const CARD = { background: '#0D0E14', border: '1px solid #44474F', borderRadius: 4 };
const H2 = {
  color: '#EDF0F3',
  fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif',
  fontWeight: 300,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.12em',
  fontSize: '0.95rem',
};

export default function OverviewPage() {
  const rows = useSimulationStore(s => s.rawRows);
  const data = computeOverviewData(rows);

  if (!data) {
    return <div className="text-sm" style={{ color: '#686B6D' }}>No data loaded.</div>;
  }

  const { bestByProfitScore, bestByDxScore, highestAbsProfit, top10, aiVsNoAi } = data;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h2 style={H2}>Overview</h2>

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
      <div style={CARD} className="p-5">
        <p
          className="text-[9px] tracking-[0.2em] uppercase mb-4"
          style={{ color: '#686B6D', fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif' }}
        >
          AI vs No-AI — Average Delta
        </p>
        <div className="grid grid-cols-5 gap-4">
          {[
            { label: 'Profit',      value: aiVsNoAi.deltaProfit,  fmt: (v: number) => formatCurrency(v),               lowerBetter: false },
            { label: 'DX Score',    value: aiVsNoAi.deltaDx,      fmt: (v: number) => v.toFixed(1),                    lowerBetter: false },
            { label: 'Wait (Rush)', value: aiVsNoAi.deltaWait,    fmt: (v: number) => v.toFixed(2) + ' min',           lowerBetter: true  },
            { label: 'Unmet',       value: aiVsNoAi.deltaUnmet,   fmt: (v: number) => (v * 100).toFixed(2) + '%',      lowerBetter: true  },
            { label: 'Peak Power',  value: aiVsNoAi.deltaPeak,    fmt: (v: number) => formatKw(v),                    lowerBetter: true  },
          ].map(({ label, value, fmt, lowerBetter }) => {
            const isGood = lowerBetter ? value <= 0 : value >= 0;
            return (
              <div key={label} className="text-center">
                <p
                  className="text-[9px] tracking-[0.15em] uppercase mb-2"
                  style={{ color: '#686B6D', fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif' }}
                >
                  {label}
                </p>
                <p
                  className="text-xl tabular-nums"
                  style={{
                    color: isGood ? '#FAFA2D' : '#ef4444',
                    fontFamily: 'Clash Grotesk, sans-serif',
                    fontWeight: 200,
                  }}
                >
                  {value >= 0 ? '+' : ''}{fmt(value)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top 10 */}
      <div style={CARD} className="p-5">
        <p
          className="text-[9px] tracking-[0.2em] uppercase mb-4"
          style={{ color: '#686B6D', fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif' }}
        >
          Top 10 by Profit Score
        </p>
        <div className="space-y-0">
          {top10.map((row, i) => (
            <div
              key={row._index}
              className="flex items-center gap-3 py-2.5"
              style={{ borderBottom: i < top10.length - 1 ? '1px solid #1A1B22' : undefined }}
            >
              <span
                className="w-6 text-xs text-right shrink-0"
                style={{ color: '#44474F', fontFamily: 'Clash Grotesk, sans-serif', fontWeight: 300 }}
              >
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" style={{ color: '#EDF0F3' }}>{row.name}</p>
                <div className="flex gap-4 mt-1.5">
                  <div className="flex-1">
                    <p className="text-[9px] tracking-wider uppercase mb-1" style={{ color: '#44474F' }}>Profit Score</p>
                    <ScoreBar value={row.maximize_profit_score} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[9px] tracking-wider uppercase mb-1" style={{ color: '#44474F' }}>DX Score</p>
                    <ScoreBar value={row.dx_score} />
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p
                  className="text-sm tabular-nums"
                  style={{ color: '#EDF0F3', fontFamily: 'Clash Grotesk, sans-serif', fontWeight: 300 }}
                >
                  {formatCurrency(row.profit)}
                </p>
                <div className="mt-1">
                  <AllocatorBadge allocator={row.allocator} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
