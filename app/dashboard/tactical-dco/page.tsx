// app/dashboard/tactical-dco/page.tsx
'use client';
import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { useSimulationStore } from '@/store/simulationStore';
import { computeMonthlyProfit } from '@/lib/compute';
import { formatCurrency } from '@/lib/utils';
import { ALLOCATOR_COLORS } from '@/constants';
import type { EnrichedRow } from '@/lib/types';

const CARD = { background: '#0D0E14', border: '1px solid #44474F', borderRadius: 4 };
const H2 = {
  color: '#EDF0F3',
  fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif',
  fontWeight: 300,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.12em',
  fontSize: '0.95rem',
};
const TOOLTIP_CONTENT = { background: '#080810', border: '1px solid #44474F', borderRadius: 4 };
const AXIS = { stroke: '#44474F', tick: { fill: '#686B6D', fontSize: 10 } };
const GRID_STROKE = '#1A1B22';

export default function TacticalDCOPage() {
  const { rawRows, settings } = useSimulationStore();

  const allocators = useMemo(
    () => Array.from(new Set(rawRows.map(r => r.allocator))).sort(),
    [rawRows]
  );

  const [selectedAllocator, setSelectedAllocator] = useState<string>(() => allocators[0] ?? 'AI');

  const chartData = useMemo(() => {
    const filtered = rawRows.filter(r => r.allocator === selectedAllocator);
    const gridInputs = Array.from(new Set(filtered.map(r => r.grid_input))).sort((a, b) => a - b);

    function avgMonthlyProfit(rows: EnrichedRow[]): number | null {
      if (!rows.length) return null;
      const byMonth: Record<string, EnrichedRow[]> = {};
      rows.forEach(r => { (byMonth[r.monthKey] ??= []).push(r); });
      const values = Object.values(byMonth).map(mRows =>
        computeMonthlyProfit(
          mRows.map(r => r.profit),
          mRows.map(r => r.max_power_demand_15m_rolling),
          settings
        )
      );
      return values.reduce((a, b) => a + b, 0) / values.length;
    }

    function avgDx(rows: EnrichedRow[]): number | null {
      const scores = rows.map(r => r.dx_score).filter((v): v is number => v !== null);
      return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    }

    return gridInputs.map(gi => {
      const rows = filtered.filter(r => r.grid_input === gi);
      const dcoOn = rows.filter(r => r.DCO);
      const dcoOff = rows.filter(r => !r.DCO);
      return {
        grid_input: gi,
        dco_on_profit: avgMonthlyProfit(dcoOn),
        dco_off_profit: avgMonthlyProfit(dcoOff),
        dco_on_dx: avgDx(dcoOn),
        dco_off_dx: avgDx(dcoOff),
      };
    });
  }, [rawRows, selectedAllocator, settings]);

  const color = ALLOCATOR_COLORS[selectedAllocator] ?? '#FAFA2D';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 style={H2}>Tactical Demand (DCO)</h2>
        <div className="flex gap-2">
          {allocators.map(a => {
            const active = selectedAllocator === a;
            return (
              <button
                key={a}
                onClick={() => setSelectedAllocator(a)}
                className="px-3 py-1 text-[10px] tracking-widest uppercase transition-colors"
                style={{
                  background: active ? '#FAFA2D' : 'transparent',
                  color: active ? '#04040B' : '#686B6D',
                  border: `1px solid ${active ? '#FAFA2D' : '#44474F'}`,
                  borderRadius: 2,
                  fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif',
                }}
              >
                {a}
              </button>
            );
          })}
        </div>
      </div>

      {chartData.length === 0 && (
        <p className="text-sm" style={{ color: '#686B6D' }}>No data available for allocator: {selectedAllocator}</p>
      )}

      {/* Monthly Profit: DCO ON vs OFF */}
      <div style={CARD} className="p-5">
        <p
          className="text-[9px] tracking-[0.18em] uppercase mb-4"
          style={{ color: '#686B6D', fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif' }}
        >
          Monthly Profit: DCO ON vs DCO OFF
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis dataKey="grid_input" tickFormatter={(v: number) => `${v}kW`} {...AXIS} />
            <YAxis tickFormatter={(v: number) => formatCurrency(v)} {...AXIS} />
            <Tooltip
              contentStyle={TOOLTIP_CONTENT}
              labelStyle={{ color: '#686B6D', fontSize: 11 }}
              formatter={(v: unknown) => [formatCurrency(v as number)]}
            />
            <Legend wrapperStyle={{ color: '#686B6D', fontSize: 11 }} />
            <Line type="monotone" dataKey="dco_on_profit" name="DCO ON" stroke={color} strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="dco_off_profit" name="DCO OFF" stroke={color} strokeWidth={1.5} strokeDasharray="6 3" dot={false} connectNulls opacity={0.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* DX Score: DCO ON vs OFF */}
      <div style={CARD} className="p-5">
        <p
          className="text-[9px] tracking-[0.18em] uppercase mb-4"
          style={{ color: '#686B6D', fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif' }}
        >
          DX Score: DCO ON vs DCO OFF
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis dataKey="grid_input" tickFormatter={(v: number) => `${v}kW`} {...AXIS} />
            <YAxis domain={[0, 100]} {...AXIS} />
            <Tooltip
              contentStyle={TOOLTIP_CONTENT}
              labelStyle={{ color: '#686B6D', fontSize: 11 }}
              formatter={(v: unknown) => [(v as number)?.toFixed(1)]}
            />
            <Legend wrapperStyle={{ color: '#686B6D', fontSize: 11 }} />
            <Line type="monotone" dataKey="dco_on_dx" name="DCO ON" stroke={color} strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="dco_off_dx" name="DCO OFF" stroke={color} strokeWidth={1.5} strokeDasharray="6 3" dot={false} connectNulls opacity={0.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
