// app/dashboard/battery-changes/page.tsx
'use client';
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useSimulationStore } from '@/store/simulationStore';
import { buildBatteryScenarios } from '@/lib/batteryScenarios';
import { formatCurrency } from '@/lib/utils';

const CARD = { background: '#0D0E14', border: '1px solid #44474F', borderRadius: 4 };
const H2 = {
  color: '#EDF0F3',
  fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif',
  fontWeight: 300,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.12em',
  fontSize: '0.95rem',
};
const CARD_TITLE = {
  color: '#686B6D',
  fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif',
  fontSize: '0.6rem',
  letterSpacing: '0.18em',
  textTransform: 'uppercase' as const,
};
const TOOLTIP_CONTENT = { background: '#080810', border: '1px solid #44474F', borderRadius: 4 };
const AXIS = { stroke: '#44474F', tick: { fill: '#686B6D', fontSize: 10 } };
const GRID_STROKE = '#1A1B22';

export default function BatteryChangesPage() {
  const { rawRows, settings } = useSimulationStore();
  const scenarios = useMemo(() => buildBatteryScenarios(rawRows, settings), [rawRows, settings]);

  if (scenarios.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm" style={{ color: '#686B6D' }}>No battery (BTM_name) data found in loaded results.</p>
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h2 style={H2}>Battery Changes</h2>

      <div className="grid grid-cols-2 gap-6">
        <div style={CARD} className="p-5">
          <p style={CARD_TITLE} className="mb-4">Monthly Profit by BESS Config</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={profitData}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
              <XAxis dataKey="name" {...AXIS} />
              <YAxis tickFormatter={(v: number) => formatCurrency(v)} {...AXIS} />
              <Tooltip contentStyle={TOOLTIP_CONTENT} formatter={(v: unknown) => [formatCurrency(v as number), 'Monthly Profit']} />
              <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                {profitData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={CARD} className="p-5">
          <p style={CARD_TITLE} className="mb-4">Avg DX Score by BESS Config</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dxData}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
              <XAxis dataKey="name" {...AXIS} />
              <YAxis domain={[0, 100]} {...AXIS} />
              <Tooltip contentStyle={TOOLTIP_CONTENT} formatter={(v: unknown) => [(v as number)?.toFixed(1), 'DX Score']} />
              <Bar dataKey="value" name="DX Score" radius={[2, 2, 0, 0]}>
                {dxData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={CARD} className="p-5">
        <p style={CARD_TITLE} className="mb-4">Energy Storage Flow (avg per day)</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={energyData}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis dataKey="name" {...AXIS} />
            <YAxis unit=" kWh" {...AXIS} />
            <Tooltip contentStyle={TOOLTIP_CONTENT} formatter={(v: unknown) => [`${(v as number).toFixed(1)} kWh`]} />
            <Bar dataKey="from" name="From Storage" fill="#FAFA2D" radius={[2, 2, 0, 0]} />
            <Bar dataKey="into" name="Into Storage" fill="#44474F" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={CARD} className="p-5">
        <p style={CARD_TITLE} className="mb-4">Scenario Summary</p>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #44474F' }}>
              {['Config', 'Avg Daily Profit', 'Monthly Profit', 'Avg DX', 'Total Energy Out'].map((h, i) => (
                <th
                  key={h}
                  className={i === 0 ? 'text-left pb-2' : 'text-right pb-2'}
                  style={{ color: '#686B6D', fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif', fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s, i) => (
              <tr key={s.id} style={{ borderBottom: i < scenarios.length - 1 ? '1px solid #1A1B22' : undefined }}>
                <td className="py-2">
                  <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: s.color }} />
                  <span style={{ color: '#EDF0F3', fontSize: '0.8rem' }}>{s.label}</span>
                </td>
                <td className="py-2 text-right tabular-nums" style={{ color: '#EDF0F3', fontFamily: 'Clash Grotesk, sans-serif', fontWeight: 300, fontSize: '0.85rem' }}>{formatCurrency(s.avgProfit)}</td>
                <td className="py-2 text-right tabular-nums" style={{ color: '#EDF0F3', fontFamily: 'Clash Grotesk, sans-serif', fontWeight: 300, fontSize: '0.85rem' }}>{formatCurrency(s.monthlyProfit)}</td>
                <td className="py-2 text-right tabular-nums" style={{ color: '#B1B3B4', fontFamily: 'Clash Grotesk, sans-serif', fontWeight: 300, fontSize: '0.85rem' }}>{s.avgDx?.toFixed(1) ?? 'N/A'}</td>
                <td className="py-2 text-right tabular-nums" style={{ color: '#B1B3B4', fontFamily: 'Clash Grotesk, sans-serif', fontWeight: 300, fontSize: '0.85rem' }}>{s.totalEnergy.toFixed(0)} kWh</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
