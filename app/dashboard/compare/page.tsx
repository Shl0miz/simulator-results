// app/dashboard/compare/page.tsx
'use client';
import { useState, useMemo } from 'react';
import { useSimulationStore } from '@/store/simulationStore';
import { computeMonthlyProfit } from '@/lib/compute';
import { ScoreBar } from '@/components/ScoreBar';
import { AllocatorBadge } from '@/components/AllocatorBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { formatCurrency, formatKw, formatScore } from '@/lib/utils';
import type { EnrichedRow } from '@/lib/types';

const PAGE_SIZE = 20;

type EnrichedRowExtended = EnrichedRow & { monthly_profit: number; optimization_score: number };

function computeBlendedScore(row: EnrichedRow, balance: number): number {
  const w = balance / 100;
  const dx = row.dx_score ?? 0;
  return (1 - w) * row.profit_score + w * dx;
}

export default function CompareTablePage() {
  const { rawRows, settings } = useSimulationStore();
  const [balance, setBalance] = useState(30);
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string>('maximize_profit_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const rowsWithMonthly = useMemo((): EnrichedRowExtended[] => {
    // Group rows by monthKey to compute monthly totals
    const byMonth: Record<string, EnrichedRow[]> = {};
    rawRows.forEach(r => { (byMonth[r.monthKey] ??= []).push(r); });

    return rawRows.map(row => {
      const monthRows = byMonth[row.monthKey] ?? [];
      const profits = monthRows.map(r => r.profit);
      const rolling = monthRows.map(r => r.max_power_demand_15m_rolling);
      const monthly_profit = computeMonthlyProfit(profits, rolling, settings);
      const optimization_score = computeBlendedScore(row, balance);
      return { ...row, monthly_profit, optimization_score };
    });
  }, [rawRows, settings, balance]);

  const sorted = useMemo(() => {
    return [...rowsWithMonthly].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey] as number ?? 0;
      const bv = (b as Record<string, unknown>)[sortKey] as number ?? 0;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
  }, [rowsWithMonthly, sortKey, sortDir]);

  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); setPage(0); }
  }

  function exportCsv() {
    const headers = ['name', 'allocator', 'start_date', 'profit', 'monthly_profit', 'dx_score', 'profit_score', 'max_power_demand_15m_rolling', 'BTM_name', 'chargers'];
    const csv = [
      headers.join(','),
      ...sorted.map(r => headers.map(h => {
        const val = (r as Record<string, unknown>)[h] ?? '';
        return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
      }).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sim-results.csv';
    a.click();
  }

  const Th = ({ label, k }: { label: string; k?: string }) => (
    <th
      className={`text-left text-xs text-slate-400 pb-2 pr-3 whitespace-nowrap select-none ${k ? 'cursor-pointer hover:text-white' : ''}`}
      onClick={() => k && toggleSort(k)}
    >
      {label}{k && sortKey === k ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
    </th>
  );

  return (
    <div className="space-y-4 max-w-full">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Compare Table</h2>
        <Button variant="outline" size="sm" onClick={exportCsv} className="border-slate-600 text-slate-300">
          Export CSV
        </Button>
      </div>

      {/* Optimization balance slider */}
      <Card className="border-slate-700" style={{ background: 'oklch(0.13 0.03 265)' }}>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400 w-20 shrink-0">Profit ←→ DX</span>
            <Slider
              value={[balance]}
              onValueChange={([v]) => { setBalance(v); setPage(0); }}
              min={0} max={100} step={5}
              className="flex-1"
            />
            <span className="text-xs text-slate-400 w-8 text-right">{balance}</span>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-sm">
          <thead style={{ background: 'oklch(0.13 0.03 265)' }}>
            <tr className="sticky top-0">
              <Th label="Name" />
              <Th label="Alloc." />
              <Th label="Date" />
              <Th label="Profit/day" k="profit" />
              <Th label="Monthly Profit" k="monthly_profit" />
              <Th label="Peak 15m" k="max_power_demand_15m_rolling" />
              <Th label="Opt Score" k="optimization_score" />
              <Th label="Profit Score" k="profit_score" />
              <Th label="DX Score" k="dx_score" />
            </tr>
          </thead>
          <tbody>
            {pageRows.map(row => (
              <tr key={row._index} className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
                <td className="py-2 pr-3 max-w-xs truncate text-white text-xs">{row.name}</td>
                <td className="py-2 pr-3"><AllocatorBadge allocator={row.allocator} /></td>
                <td className="py-2 pr-3 text-slate-400 text-xs">{row.start_date}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-200">{formatCurrency(row.profit)}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-200">{formatCurrency(row.monthly_profit)}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-400">{formatKw(row.max_power_demand_15m_rolling)}</td>
                <td className="py-2 pr-3 w-32"><ScoreBar value={row.optimization_score} /></td>
                <td className="py-2 pr-3 w-32"><ScoreBar value={row.profit_score} /></td>
                <td className="py-2 pr-3 w-32"><ScoreBar value={row.dx_score} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>{sorted.length} configurations</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0}
                  onClick={() => setPage(p => p - 1)} className="border-slate-600 text-slate-300">
            Previous
          </Button>
          <span className="px-2">Page {page + 1} / {totalPages || 1}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)} className="border-slate-600 text-slate-300">
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
