// app/dashboard/charger-changes/page.tsx
'use client';
import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ScatterChart, Scatter,
} from 'recharts';
import { useSimulationStore } from '@/store/simulationStore';
import { buildChargerScenarios } from '@/lib/chargerScenarios';
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
const AXIS = { stroke: '#44474F', tick: { fill: '#686B6D', fontSize: 11 } };
const GRID_STROKE = '#1A1B22';

export default function ChargerChangesPage() {
  const { rawRows, settings } = useSimulationStore();
  const scenarios = useMemo(() => buildChargerScenarios(rawRows, settings), [rawRows, settings]);

  if (scenarios.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm" style={{ color: '#686B6D' }}>No charger configuration data found.</p>
      </div>
    );
  }

  const profitData = scenarios.map(s => ({ name: s.label, value: s.monthlyProfit, color: s.color }));

  const best = {
    profit: scenarios.reduce((a, b) => a.monthlyProfit > b.monthlyProfit ? a : b),
    dx: scenarios.reduce((a, b) => (a.avgDx ?? 0) > (b.avgDx ?? 0) ? a : b),
    energy: scenarios.reduce((a, b) => a.totalEnergy > b.totalEnergy ? a : b),
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h2 style={H2}>Charger Changes</h2>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Best Profit', s: best.profit, val: formatCurrency(best.profit.monthlyProfit) },
          { label: 'Best DX',     s: best.dx,     val: best.dx.avgDx?.toFixed(1) ?? 'N/A' },
          { label: 'Best Energy', s: best.energy, val: best.energy.totalEnergy.toFixed(0) + ' kWh' },
        ].map(({ label, s, val }) => (
          <div key={label} style={CARD} className="p-4">
            <p style={CARD_TITLE} className="mb-2">{label}</p>
            <p
              className="tabular-nums leading-none"
              style={{ color: '#EDF0F3', fontFamily: 'Clash Grotesk, sans-serif', fontWeight: 200, fontSize: '1.5rem' }}
            >
              {val}
            </p>
            <p className="text-xs mt-1.5 truncate" style={{ color: '#686B6D' }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div style={CARD} className="p-5">
          <p style={CARD_TITLE} className="mb-4">Monthly Profit by Charger Layout</p>
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
          <p style={CARD_TITLE} className="mb-4">DX Score vs Monthly Profit</p>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
              <XAxis type="number" dataKey="x" name="DX Score" domain={[0, 100]} {...AXIS} />
              <YAxis type="number" dataKey="y" name="Monthly Profit"
                     tickFormatter={(v: number) => formatCurrency(v)} {...AXIS} />
              <Tooltip
                contentStyle={TOOLTIP_CONTENT}
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
        </div>
      </div>
    </div>
  );
}
