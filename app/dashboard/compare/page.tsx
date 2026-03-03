// app/dashboard/compare/page.tsx
'use client';
import { useState, useMemo } from 'react';
import { useSimulationStore } from '@/store/simulationStore';
import { computeMonthlyProfit } from '@/lib/compute';
import { ScoreBar } from '@/components/ScoreBar';
import { AllocatorBadge } from '@/components/AllocatorBadge';
import { Slider } from '@/components/ui/slider';
import { formatCurrency, formatKw, formatScore } from '@/lib/utils';
import type { EnrichedRow } from '@/lib/types';

const PAGE_SIZE = 20;

type EnrichedRowExtended = EnrichedRow & { monthly_profit: number; optimization_score: number };

const CARD = { background: '#0D0E14', border: '1px solid #44474F', borderRadius: 4 };
const H2 = {
  color: '#EDF0F3',
  fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif',
  fontWeight: 300,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.12em',
  fontSize: '0.95rem',
};

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
    const byMonth: Record<string, EnrichedRow[]> = {};
    rawRows.forEach(r => { (byMonth[r.monthKey] ??= []).push(r); });
    return rawRows.map(row => {
      const monthRows = byMonth[row.monthKey] ?? [];
      const monthly_profit = computeMonthlyProfit(
        monthRows.map(r => r.profit),
        monthRows.map(r => r.max_power_demand_15m_rolling),
        settings
      );
      return { ...row, monthly_profit, optimization_score: computeBlendedScore(row, balance) };
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

  const thStyle = (clickable: boolean) => ({
    color: '#686B6D',
    fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif',
    fontSize: '0.6rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    cursor: clickable ? 'pointer' : 'default',
    userSelect: 'none' as const,
    paddingBottom: '0.5rem',
    paddingRight: '0.75rem',
    whiteSpace: 'nowrap' as const,
  });

  const Th = ({ label, k }: { label: string; k?: string }) => (
    <th
      style={thStyle(!!k)}
      className={k ? 'hover:text-[#EDF0F3] transition-colors' : ''}
      onClick={() => k && toggleSort(k)}
    >
      {label}{k && sortKey === k ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
    </th>
  );

  return (
    <div className="space-y-4 max-w-full">
      <div className="flex items-center justify-between">
        <h2 style={H2}>Compare Table</h2>
        <button
          onClick={exportCsv}
          className="px-3 py-1.5 text-[10px] tracking-widest uppercase transition-colors"
          style={{
            background: 'transparent',
            color: '#FAFA2D',
            border: '1px solid #FAFA2D44',
            borderRadius: 2,
            fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif',
          }}
        >
          Export CSV
        </button>
      </div>

      {/* Optimization balance slider */}
      <div style={CARD} className="p-4">
        <div className="flex items-center gap-4">
          <span
            className="text-[10px] tracking-wider uppercase w-24 shrink-0"
            style={{ color: '#686B6D', fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif' }}
          >
            Profit ←→ DX
          </span>
          <Slider
            value={[balance]}
            onValueChange={([v]) => { setBalance(v); setPage(0); }}
            min={0} max={100} step={5}
            className="flex-1"
          />
          <span
            className="text-sm w-8 text-right tabular-nums"
            style={{ color: '#FAFA2D', fontFamily: 'Clash Grotesk, sans-serif', fontWeight: 300 }}
          >
            {balance}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded" style={{ border: '1px solid #44474F' }}>
        <table className="w-full text-sm">
          <thead style={{ background: '#0D0E14' }}>
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
              <tr
                key={row._index}
                className="transition-colors"
                style={{ borderTop: '1px solid #1A1B22' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#141520')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <td className="py-2 pr-3 max-w-xs truncate text-xs" style={{ color: '#EDF0F3' }}>{row.name}</td>
                <td className="py-2 pr-3"><AllocatorBadge allocator={row.allocator} /></td>
                <td className="py-2 pr-3 text-xs" style={{ color: '#686B6D' }}>{row.start_date}</td>
                <td className="py-2 pr-3 tabular-nums text-xs" style={{ color: '#EDF0F3', fontFamily: 'Clash Grotesk, sans-serif', fontWeight: 300 }}>{formatCurrency(row.profit)}</td>
                <td className="py-2 pr-3 tabular-nums text-xs" style={{ color: '#EDF0F3', fontFamily: 'Clash Grotesk, sans-serif', fontWeight: 300 }}>{formatCurrency(row.monthly_profit)}</td>
                <td className="py-2 pr-3 tabular-nums text-xs" style={{ color: '#686B6D' }}>{formatKw(row.max_power_demand_15m_rolling)}</td>
                <td className="py-2 pr-3 w-32"><ScoreBar value={row.optimization_score} /></td>
                <td className="py-2 pr-3 w-32"><ScoreBar value={row.profit_score} /></td>
                <td className="py-2 pr-3 w-32"><ScoreBar value={row.dx_score} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs" style={{ color: '#686B6D' }}>
        <span>{sorted.length} configurations</span>
        <div className="flex items-center gap-2">
          <button
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1 text-[10px] tracking-wider uppercase disabled:opacity-40 transition-opacity"
            style={{ color: '#B1B3B4', border: '1px solid #44474F', borderRadius: 2, background: 'transparent' }}
          >
            Previous
          </button>
          <span className="px-2 tabular-nums">Page {page + 1} / {totalPages || 1}</span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1 text-[10px] tracking-wider uppercase disabled:opacity-40 transition-opacity"
            style={{ color: '#B1B3B4', border: '1px solid #44474F', borderRadius: 2, background: 'transparent' }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
