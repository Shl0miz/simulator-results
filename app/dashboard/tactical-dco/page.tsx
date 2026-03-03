// app/dashboard/tactical-dco/page.tsx
'use client';
import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { useSimulationStore } from '@/store/simulationStore';
import { computeMonthlyProfit } from '@/lib/compute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { ALLOCATOR_COLORS } from '@/constants';
import type { EnrichedRow } from '@/lib/types';

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

  const color = ALLOCATOR_COLORS[selectedAllocator] ?? '#3b82f6';

  const tooltipStyle = {
    contentStyle: { background: 'oklch(0.09 0.02 265)', border: '1px solid #334155', borderRadius: 6 },
    labelStyle: { color: '#94a3b8' },
  };

  const axisProps = { stroke: '#334155', tick: { fill: '#94a3b8', fontSize: 11 } };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Tactical Demand (DCO)</h2>
        <div className="flex gap-2">
          {allocators.map(a => (
            <button
              key={a}
              onClick={() => setSelectedAllocator(a)}
              className={`px-3 py-1 rounded text-sm border transition-colors ${
                selectedAllocator === a
                  ? 'border-blue-500 text-white bg-blue-500/20'
                  : 'border-slate-600 text-slate-400 hover:text-white'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 && (
        <p className="text-slate-400">No data available for allocator: {selectedAllocator}</p>
      )}

      {/* Monthly Profit: DCO ON vs OFF */}
      <Card className="border-slate-700" style={{ background: 'oklch(0.13 0.03 265)' }}>
        <CardHeader>
          <CardTitle className="text-sm text-slate-300">Monthly Profit: DCO ON vs DCO OFF</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="grid_input" tickFormatter={(v: number) => `${v}kW`} {...axisProps} />
              <YAxis tickFormatter={(v: number) => formatCurrency(v)} {...axisProps} />
              <Tooltip {...tooltipStyle} formatter={(v: unknown) => [formatCurrency(v as number)]} />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
              <Line type="monotone" dataKey="dco_on_profit" name="DCO ON" stroke={color} strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="dco_off_profit" name="DCO OFF" stroke={color} strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* DX Score: DCO ON vs OFF */}
      <Card className="border-slate-700" style={{ background: 'oklch(0.13 0.03 265)' }}>
        <CardHeader>
          <CardTitle className="text-sm text-slate-300">DX Score: DCO ON vs DCO OFF</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="grid_input" tickFormatter={(v: number) => `${v}kW`} {...axisProps} />
              <YAxis domain={[0, 100]} {...axisProps} />
              <Tooltip {...tooltipStyle} formatter={(v: unknown) => [(v as number)?.toFixed(1)]} />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
              <Line type="monotone" dataKey="dco_on_dx" name="DCO ON" stroke={color} strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="dco_off_dx" name="DCO OFF" stroke={color} strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
