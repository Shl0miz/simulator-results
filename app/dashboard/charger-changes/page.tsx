// app/dashboard/charger-changes/page.tsx
'use client';
import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ScatterChart, Scatter,
} from 'recharts';
import { useSimulationStore } from '@/store/simulationStore';
import { buildChargerScenarios } from '@/lib/chargerScenarios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

export default function ChargerChangesPage() {
  const { rawRows, settings } = useSimulationStore();
  const scenarios = useMemo(() => buildChargerScenarios(rawRows, settings), [rawRows, settings]);

  if (scenarios.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">No charger configuration data found.</p>
      </div>
    );
  }

  const profitData = scenarios.map(s => ({ name: s.label, value: s.monthlyProfit, color: s.color }));

  const best = {
    profit: scenarios.reduce((a, b) => a.monthlyProfit > b.monthlyProfit ? a : b),
    dx: scenarios.reduce((a, b) => (a.avgDx ?? 0) > (b.avgDx ?? 0) ? a : b),
    energy: scenarios.reduce((a, b) => a.totalEnergy > b.totalEnergy ? a : b),
  };

  const cardStyle = { background: 'oklch(0.13 0.03 265)' };
  const tooltipStyle = {
    contentStyle: { background: 'oklch(0.09 0.02 265)', border: '1px solid #334155', borderRadius: 6 },
  };
  const axisProps = { stroke: '#334155', tick: { fill: '#94a3b8', fontSize: 11 } };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h2 className="text-xl font-bold text-white">Charger Changes</h2>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Best Profit', s: best.profit, val: formatCurrency(best.profit.monthlyProfit) },
          { label: 'Best DX',     s: best.dx,     val: best.dx.avgDx?.toFixed(1) ?? 'N/A' },
          { label: 'Best Energy', s: best.energy, val: best.energy.totalEnergy.toFixed(0) + ' kWh' },
        ].map(({ label, s, val }) => (
          <Card key={label} className="border-slate-700" style={cardStyle}>
            <CardContent className="pt-4">
              <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
              <p className="text-xl font-bold text-white mt-1 tabular-nums">{val}</p>
              <p className="text-xs text-slate-400 mt-1 truncate">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card className="border-slate-700" style={cardStyle}>
          <CardHeader><CardTitle className="text-sm text-slate-300">Monthly Profit by Charger Layout</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={profitData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis tickFormatter={(v: number) => formatCurrency(v)} {...axisProps} />
                <Tooltip {...tooltipStyle} formatter={(v: unknown) => [formatCurrency(v as number), 'Monthly Profit']} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {profitData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-700" style={cardStyle}>
          <CardHeader><CardTitle className="text-sm text-slate-300">DX Score vs Monthly Profit</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                <XAxis type="number" dataKey="x" name="DX Score" domain={[0, 100]} {...axisProps} />
                <YAxis type="number" dataKey="y" name="Monthly Profit"
                       tickFormatter={(v: number) => formatCurrency(v)} {...axisProps} />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v: unknown, name: string | undefined) => [
                    name === 'y' ? formatCurrency(v as number) : (v as number).toFixed(1),
                    name === 'y' ? 'Monthly Profit' : 'DX Score',
                  ]}
                />
                {scenarios.map(s => (
                  <Scatter
                    key={s.id}
                    name={s.label}
                    data={[{ x: s.avgDx ?? 0, y: s.monthlyProfit }]}
                    fill={s.color}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
