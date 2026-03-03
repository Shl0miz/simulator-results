// app/dashboard/battery-changes/page.tsx
'use client';
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useSimulationStore } from '@/store/simulationStore';
import { buildBatteryScenarios } from '@/lib/batteryScenarios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

export default function BatteryChangesPage() {
  const { rawRows, settings } = useSimulationStore();
  const scenarios = useMemo(() => buildBatteryScenarios(rawRows, settings), [rawRows, settings]);

  if (scenarios.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">No battery (BTM_name) data found in loaded results.</p>
      </div>
    );
  }

  const profitData = scenarios.map(s => ({ name: s.label, value: s.monthlyProfit, color: s.color }));
  const dxData = scenarios.map(s => ({ name: s.label, value: s.avgDx, color: s.color }));
  const energyData = scenarios.map(s => ({
    name: s.label,
    from: s.energyFromStorage,
    into: s.energyIntoStorage,
    color: s.color,
  }));

  const cardStyle = { background: 'oklch(0.13 0.03 265)' };
  const tooltipStyle = {
    contentStyle: { background: 'oklch(0.09 0.02 265)', border: '1px solid #334155', borderRadius: 6 },
  };
  const axisProps = { stroke: '#334155', tick: { fill: '#94a3b8', fontSize: 10 } };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h2 className="text-xl font-bold text-white">Battery Changes</h2>

      <div className="grid grid-cols-2 gap-6">
        <Card className="border-slate-700" style={cardStyle}>
          <CardHeader><CardTitle className="text-sm text-slate-300">Monthly Profit by BESS Config</CardTitle></CardHeader>
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
          <CardHeader><CardTitle className="text-sm text-slate-300">Avg DX Score by BESS Config</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dxData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis domain={[0, 100]} {...axisProps} />
                <Tooltip {...tooltipStyle} formatter={(v: unknown) => [(v as number)?.toFixed(1), 'DX Score']} />
                <Bar dataKey="value" name="DX Score" radius={[4, 4, 0, 0]}>
                  {dxData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-700" style={cardStyle}>
        <CardHeader><CardTitle className="text-sm text-slate-300">Energy Storage Flow (avg per day)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={energyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis unit=" kWh" {...axisProps} />
              <Tooltip {...tooltipStyle} formatter={(v: unknown) => [`${(v as number).toFixed(1)} kWh`]} />
              <Bar dataKey="from" name="From Storage" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="into" name="Into Storage" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-slate-700" style={cardStyle}>
        <CardHeader><CardTitle className="text-sm text-slate-300">Scenario Summary</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-700">
                <th className="text-left pb-2">Config</th>
                <th className="text-right pb-2">Avg Daily Profit</th>
                <th className="text-right pb-2">Monthly Profit</th>
                <th className="text-right pb-2">Avg DX</th>
                <th className="text-right pb-2">Total Energy Out</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map(s => (
                <tr key={s.id} className="border-b border-slate-800 last:border-0">
                  <td className="py-2">
                    <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </td>
                  <td className="py-2 text-right tabular-nums text-slate-200">{formatCurrency(s.avgProfit)}</td>
                  <td className="py-2 text-right tabular-nums text-slate-200">{formatCurrency(s.monthlyProfit)}</td>
                  <td className="py-2 text-right tabular-nums text-slate-300">{s.avgDx?.toFixed(1) ?? 'N/A'}</td>
                  <td className="py-2 text-right tabular-nums text-slate-300">{s.totalEnergy.toFixed(0)} kWh</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
