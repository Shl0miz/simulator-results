# Simulator Results Platform — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a 5-tab client-side EV charging simulation results viewer in Next.js that loads JSON from a configurable API endpoint and renders interactive charts and tables.

**Architecture:** Next.js 14 App Router (client components for charts), Zustand for global data + filter state, Recharts for all charts, runtime API config JSON so the endpoint can change without code changes. The data layer has a CORS-proxy API route, an enrichment step (scores, month bucketing), and a filter layer — all separate from UI components.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Recharts, Zustand, date-fns

---

## Phase 1: Project Scaffold

### Task 1: Initialize Next.js project

**Files:**
- Create: `~/Documents/simulator-results/` (project root)

**Step 1: Scaffold the project**

```bash
cd ~/Documents
npx create-next-app@latest simulator-results \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*"
cd simulator-results
```

**Step 2: Install dependencies**

```bash
npm install recharts zustand date-fns
npm install @radix-ui/react-slider @radix-ui/react-switch @radix-ui/react-select @radix-ui/react-tooltip
npm install lucide-react clsx tailwind-merge class-variance-authority
npm install --save-dev @types/node
```

**Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init
```
When prompted: style = Default, base color = Slate, CSS variables = yes.

Then add needed components:
```bash
npx shadcn@latest add card badge button input label slider switch select table tooltip tabs dialog
```

**Step 4: Verify dev server starts**

```bash
npm run dev
```
Expected: Server starts on http://localhost:3000, default Next.js page visible.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 14 + Tailwind + shadcn/ui"
```

---

## Phase 2: Types & Constants

### Task 2: Core TypeScript types

**Files:**
- Create: `lib/types.ts`

**Step 1: Write the types**

```typescript
// lib/types.ts

/** Raw row as returned by the simulation API */
export interface SimulationResult {
  // Identifiers
  allocator: string;           // "AI" | "COM" | "NOCHECKS"
  chargers: string;            // e.g. "DUAL-180:DUAL-180:DUAL-180"
  duration_days: number;       // load multiplier, 1.0 = 100%
  start_date: string;          // "YYYY-MM-DD"
  use_transaction_durations: number;
  grid_input: number;          // kW
  BTM_name?: string;           // BESS config name
  site_name?: string;

  // Performance
  profit: number;
  total_energy_out: number;
  total_energy_in: number;
  revenue: number;
  max_power_demand_1s: number;
  max_power_demand_15m_rolling: number;
  max_power_demand_15m_fixed: number;

  // Driver experience (from API only)
  DX?: number;                 // dx_score — never computed locally
  mean_wait_per_driver_rush_hour: number;
  mean_unmet_rush_hour: number;
  reneg_events_rush_hour: number;
  reneg_events: number;

  // Utilization
  mean_utilization: number;
  daily_sessions_per_connector: number;
  num_attempted_sessions: number;
  num_successful_sessions: number;
  num_failed_sessions: number;

  // Storage
  energy_from_storage: number;
  energy_into_storage: number;

  // Sessions stats
  sessions_totalEnergy: number;
  sessions_durationSeconds: number;
  sessions_medianPower: number;
  sessions_unmetDemandRatio: number;
  sessions_energyInFirst10Minutes: number;

  // DCO
  demand_charge_optimizer_power_limit_kW?: number;

  // Allow additional fields from API
  [key: string]: unknown;
}

/** Row after enrichment */
export interface EnrichedRow extends SimulationResult {
  // Computed identifiers
  _index: number;
  name: string;               // human-readable label
  AI: boolean;
  DCO: boolean;
  loadPercent: number;        // duration_days * 100
  monthKey: string;           // "YYYY-MM"

  // Scores (profit_score requires all rows for normalization)
  dx_score: number | null;    // from API DX field only
  profit_score: number;       // MinMax normalized 0-100
  maximize_profit_score: number; // 70% profit + 30% dx
  maximize_dx_score: number;     // 30% profit + 70% dx
}

/** Global settings from sidebar */
export interface GlobalSettings {
  demandChargeRate: number;   // $/kW, default 20
  applyDemandCharges: boolean; // default false
}

/** Flexible API config — loaded from config/api.config.json at runtime */
export interface ApiConfig {
  baseUrl: string;
  endpoint: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  /** JSONPath-style dot-notation to the results array, e.g. "data.results" */
  resultsPath?: string;
  /** Field mapping overrides, e.g. { dx_score: "DX" } */
  fieldMap?: Record<string, string>;
}
```

**Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add core TypeScript types"
```

---

### Task 3: Constants

**Files:**
- Create: `constants/index.ts`

**Step 1: Write constants**

```typescript
// constants/index.ts

export const DAYS_PER_MONTH = 30;

export const LOAD_LABELS: Record<number, string> = {
  1:    'Current load',
  1.27: '+20% load',
  1.6:  '+60% load',
  2.03: '+100% load',
};

export const ALLOCATOR_COLORS: Record<string, string> = {
  AI:       '#3b82f6',  // blue
  COM:      '#f97316',  // orange
  NOCHECKS: '#6b7280',  // grey
};

export const SCENARIO_COLORS = [
  '#3b82f6', '#f97316', '#22c55e', '#a855f7',
  '#ec4899', '#14b8a6', '#f59e0b', '#6366f1',
];

export const DEFAULT_SETTINGS = {
  demandChargeRate: 20,
  applyDemandCharges: false,
};

export const SCORE_WEIGHTS = {
  maximize_profit: { profit: 0.7, dx: 0.3 },
  maximize_dx:     { profit: 0.3, dx: 0.7 },
};
```

**Step 2: Commit**

```bash
git add constants/index.ts
git commit -m "feat: add constants"
```

---

## Phase 3: Data Layer

### Task 4: API config file

**Files:**
- Create: `config/api.config.json`
- Create: `lib/apiClient.ts`

**Step 1: Create placeholder API config**

```json
{
  "baseUrl": "http://localhost:8000",
  "endpoint": "/results",
  "method": "GET",
  "headers": {},
  "queryParams": {},
  "resultsPath": "",
  "fieldMap": {}
}
```
> This file is replaced by the user with actual API details. The code reads it at runtime.

**Step 2: Write apiClient.ts**

```typescript
// lib/apiClient.ts
import type { ApiConfig, SimulationResult } from './types';

/** Resolve a dot-path string against an object, e.g. "data.results" */
function resolvePath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return path.split('.').reduce((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

/** Apply fieldMap: renames keys in each row according to config */
function applyFieldMap(
  rows: Record<string, unknown>[],
  fieldMap: Record<string, string>
): Record<string, unknown>[] {
  if (!fieldMap || Object.keys(fieldMap).length === 0) return rows;
  return rows.map(row => {
    const mapped: Record<string, unknown> = { ...row };
    for (const [target, source] of Object.entries(fieldMap)) {
      if (source in row) {
        mapped[target] = row[source];
      }
    }
    return mapped;
  });
}

export async function fetchResults(
  config: ApiConfig,
  userUrl?: string
): Promise<SimulationResult[]> {
  const url = userUrl
    ? userUrl
    : `${config.baseUrl}${config.endpoint}`;

  const fullUrl = config.queryParams && Object.keys(config.queryParams).length > 0
    ? `${url}?${new URLSearchParams(config.queryParams)}`
    : url;

  const response = await fetch(`/api/fetch-results?url=${encodeURIComponent(fullUrl)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch results: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  const raw = resolvePath(json, config.resultsPath ?? '') as unknown[];

  if (!Array.isArray(raw)) {
    throw new Error('API response does not contain an array at the configured results path');
  }

  const mapped = applyFieldMap(raw as Record<string, unknown>[], config.fieldMap ?? {});
  return mapped as SimulationResult[];
}
```

**Step 3: Commit**

```bash
git add config/api.config.json lib/apiClient.ts
git commit -m "feat: add flexible API client with runtime config"
```

---

### Task 5: CORS proxy API route

**Files:**
- Create: `app/api/fetch-results/route.ts`

**Step 1: Write the proxy route**

```typescript
// app/api/fetch-results/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const targetUrl = req.nextUrl.searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const upstream = await fetch(decodeURIComponent(targetUrl), {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: `Proxy fetch failed: ${String(err)}` },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add app/api/fetch-results/route.ts
git commit -m "feat: add CORS proxy API route"
```

---

### Task 6: Compute & enrichment

**Files:**
- Create: `lib/compute.ts`
- Create: `lib/compute.test.ts`

**Step 1: Write failing tests**

```typescript
// lib/compute.test.ts
import { enrichRows, computeMonthlyProfit } from './compute';
import type { SimulationResult } from './types';

const mockRow = (overrides: Partial<SimulationResult> = {}): SimulationResult => ({
  allocator: 'AI',
  chargers: 'DUAL-180:DUAL-180',
  duration_days: 1,
  start_date: '2025-02-28',
  use_transaction_durations: 0.5,
  grid_input: 310,
  profit: 2813,
  total_energy_out: 1298,
  total_energy_in: 798,
  revenue: 2880,
  max_power_demand_1s: 310,
  max_power_demand_15m_rolling: 288,
  max_power_demand_15m_fixed: 273,
  mean_wait_per_driver_rush_hour: 0,
  mean_unmet_rush_hour: 0.1375,
  reneg_events_rush_hour: 0,
  reneg_events: 0,
  mean_utilization: 0.14,
  daily_sessions_per_connector: 8.5,
  num_attempted_sessions: 51,
  num_successful_sessions: 47,
  num_failed_sessions: 4,
  energy_from_storage: 0,
  energy_into_storage: 0,
  sessions_totalEnergy: 28,
  sessions_durationSeconds: 1370,
  sessions_medianPower: 83,
  sessions_unmetDemandRatio: 0.29,
  sessions_energyInFirst10Minutes: 14,
  DX: 75,
  ...overrides,
});

test('enrichRows: AI flag set correctly', () => {
  const rows = [mockRow({ allocator: 'AI' }), mockRow({ allocator: 'COM' })];
  const enriched = enrichRows(rows);
  expect(enriched[0].AI).toBe(true);
  expect(enriched[1].AI).toBe(false);
});

test('enrichRows: monthKey parsed from start_date', () => {
  const rows = [mockRow({ start_date: '2025-03-15' })];
  const enriched = enrichRows(rows);
  expect(enriched[0].monthKey).toBe('2025-03');
});

test('enrichRows: dx_score from DX field only', () => {
  const rows = [mockRow({ DX: 82 })];
  const enriched = enrichRows(rows);
  expect(enriched[0].dx_score).toBe(82);
});

test('enrichRows: dx_score null when DX absent', () => {
  const row = mockRow();
  delete (row as Partial<SimulationResult>).DX;
  const enriched = enrichRows([row]);
  expect(enriched[0].dx_score).toBeNull();
});

test('computeMonthlyProfit: sums profit, no demand charge', () => {
  const result = computeMonthlyProfit([2000, 3000, 1500], [], { demandChargeRate: 20, applyDemandCharges: false });
  expect(result).toBe(6500);
});

test('computeMonthlyProfit: applies demand charge with max 15m rolling', () => {
  const profits = [2000, 3000];
  const rolling = [250, 300];
  const result = computeMonthlyProfit(profits, rolling, { demandChargeRate: 20, applyDemandCharges: true });
  // 5000 - 20 * 300 = 5000 - 6000 = -1000
  expect(result).toBe(-1000);
});
```

**Step 2: Run tests — expect FAIL**

```bash
npx jest lib/compute.test.ts
```
Expected: FAIL — `enrichRows` and `computeMonthlyProfit` not defined.

**Step 3: Write compute.ts**

```typescript
// lib/compute.ts
import type { SimulationResult, EnrichedRow, GlobalSettings } from './types';

export function computeMonthlyProfit(
  profits: number[],
  rollingDemands: number[],
  settings: GlobalSettings
): number {
  const totalProfit = profits.reduce((sum, p) => sum + p, 0);
  if (!settings.applyDemandCharges || rollingDemands.length === 0) {
    return totalProfit;
  }
  const peakDemand = Math.max(...rollingDemands);
  return totalProfit - settings.demandChargeRate * peakDemand;
}

function minMax(values: number[]): (v: number) => number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return () => 100;
  return (v: number) => ((v - min) / (max - min)) * 100;
}

export function enrichRows(rows: SimulationResult[]): EnrichedRow[] {
  // Compute profit_score normalization across all rows
  const profits = rows.map(r => r.profit);
  const normProfit = minMax(profits);

  return rows.map((row, i): EnrichedRow => {
    const AI = row.allocator === 'AI';
    const DCO = row.demand_charge_optimizer_power_limit_kW != null &&
                row.demand_charge_optimizer_power_limit_kW > 0;
    const loadPercent = Math.round(row.duration_days * 100);
    const monthKey = row.start_date.slice(0, 7); // "YYYY-MM"

    const dx_score = (row.DX != null) ? row.DX : null;
    const profit_score = normProfit(row.profit);

    const maximize_profit_score = dx_score != null
      ? 0.7 * profit_score + 0.3 * dx_score
      : profit_score;

    const maximize_dx_score = dx_score != null
      ? 0.3 * profit_score + 0.7 * dx_score
      : profit_score;

    // Build human-readable name
    const chargerLabel = parseChargers(row.chargers);
    const name = `${row.allocator} | ${chargerLabel} | ${loadPercent}% | ${row.grid_input}kW`;

    return {
      ...row,
      _index: i,
      name,
      AI,
      DCO,
      loadPercent,
      monthKey,
      dx_score,
      profit_score,
      maximize_profit_score,
      maximize_dx_score,
    };
  });
}

/** "DUAL-180:DUAL-180:DUAL-180" -> "3x Dual-180kW" */
export function parseChargers(chargers: string): string {
  if (!chargers) return 'Unknown';
  const parts = chargers.split(':');
  const counts: Record<string, number> = {};
  for (const p of parts) {
    counts[p] = (counts[p] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([type, count]) => {
      const readable = type.replace('DUAL-', 'Dual-').replace('SINGLE-', 'Single-') + 'kW';
      return `${count}x ${readable}`;
    })
    .join(' + ');
}
```

**Step 4: Run tests — expect PASS**

```bash
npx jest lib/compute.test.ts
```
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add lib/compute.ts lib/compute.test.ts
git commit -m "feat: add enrichment and monthly profit computation (TDD)"
```

---

### Task 7: Zustand store

**Files:**
- Create: `store/simulationStore.ts`

**Step 1: Write the store**

```typescript
// store/simulationStore.ts
'use client';
import { create } from 'zustand';
import type { EnrichedRow, GlobalSettings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/constants';

interface SimulationStore {
  // Data
  rawRows: EnrichedRow[];
  isLoading: boolean;
  error: string | null;
  loadedUrl: string | null;

  // Settings (sidebar controls)
  settings: GlobalSettings;

  // Actions
  setRows: (rows: EnrichedRow[]) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  setLoadedUrl: (url: string) => void;
  updateSettings: (patch: Partial<GlobalSettings>) => void;
  reset: () => void;
}

export const useSimulationStore = create<SimulationStore>((set) => ({
  rawRows: [],
  isLoading: false,
  error: null,
  loadedUrl: null,
  settings: { ...DEFAULT_SETTINGS },

  setRows: (rows) => set({ rawRows: rows }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setLoadedUrl: (loadedUrl) => set({ loadedUrl }),
  updateSettings: (patch) =>
    set((state) => ({ settings: { ...state.settings, ...patch } })),
  reset: () =>
    set({ rawRows: [], isLoading: false, error: null, loadedUrl: null }),
}));
```

**Step 2: Commit**

```bash
git add store/simulationStore.ts
git commit -m "feat: add Zustand simulation store"
```

---

## Phase 4: Shared UI Components

### Task 8: Utility functions

**Files:**
- Create: `lib/utils.ts` (extend the scaffolded one)

**Step 1: Add formatters**

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }
  return `$${value.toFixed(0)}`;
}

export function formatKw(value: number): string {
  return `${value.toFixed(0)} kW`;
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatScore(value: number | null): string {
  if (value === null) return 'N/A';
  return value.toFixed(1);
}

export function getMonthLabel(monthKey: string): string {
  // "2025-03" -> "Mar 2025"
  const [year, month] = monthKey.split('-');
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
```

**Step 2: Commit**

```bash
git add lib/utils.ts
git commit -m "feat: add formatting utility functions"
```

---

### Task 9: ScoreBar component

**Files:**
- Create: `components/ScoreBar.tsx`

**Step 1: Write the component**

```typescript
// components/ScoreBar.tsx
import { cn } from '@/lib/utils';

interface ScoreBars {
  value: number | null;
  max?: number;
  colorOverride?: string;
  showLabel?: boolean;
  className?: string;
}

export function ScoreBar({ value, max = 100, colorOverride, showLabel = true, className }: ScoreBars) {
  if (value === null) {
    return <span className="text-muted-foreground text-xs">N/A</span>;
  }
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const color = colorOverride ?? (pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444');

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {showLabel && (
        <span className="text-xs tabular-nums w-10 text-right text-muted-foreground">
          {value.toFixed(1)}
        </span>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/ScoreBar.tsx
git commit -m "feat: add ScoreBar component"
```

---

### Task 10: KPICard component

**Files:**
- Create: `components/KPICard.tsx`

**Step 1: Write the component**

```typescript
// components/KPICard.tsx
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  delta?: number;
  deltaLabel?: string;
  className?: string;
}

export function KPICard({ title, value, subtitle, delta, deltaLabel, className }: KPICardProps) {
  const deltaPositive = delta != null && delta >= 0;
  return (
    <Card className={cn('bg-slate-900 border-slate-700', className)}>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{title}</p>
        <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-1 truncate">{subtitle}</p>}
        {delta != null && (
          <p className={cn('text-sm font-medium mt-1', deltaPositive ? 'text-green-400' : 'text-red-400')}>
            {deltaPositive ? '+' : ''}{delta.toFixed(1)} {deltaLabel}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add components/KPICard.tsx
git commit -m "feat: add KPICard component"
```

---

### Task 11: AllocatorBadge component

**Files:**
- Create: `components/AllocatorBadge.tsx`

**Step 1: Write the component**

```typescript
// components/AllocatorBadge.tsx
import { Badge } from '@/components/ui/badge';
import { ALLOCATOR_COLORS } from '@/constants';

export function AllocatorBadge({ allocator }: { allocator: string }) {
  const color = ALLOCATOR_COLORS[allocator] ?? '#6b7280';
  return (
    <Badge
      style={{ backgroundColor: color + '22', color, borderColor: color + '55' }}
      variant="outline"
      className="text-xs font-mono"
    >
      {allocator}
    </Badge>
  );
}
```

**Step 2: Commit**

```bash
git add components/AllocatorBadge.tsx
git commit -m "feat: add AllocatorBadge component"
```

---

## Phase 5: App Shell

### Task 12: Global layout & theme

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

**Step 1: Update globals.css for dark theme base**

Replace the content of `app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 222 47% 6%;
    --foreground: 210 40% 95%;
    --card: 222 47% 9%;
    --card-foreground: 210 40% 95%;
    --popover: 222 47% 9%;
    --popover-foreground: 210 40% 95%;
    --primary: 217 91% 60%;
    --primary-foreground: 222 47% 6%;
    --secondary: 217 33% 17%;
    --secondary-foreground: 210 40% 95%;
    --muted: 217 33% 17%;
    --muted-foreground: 215 20% 55%;
    --accent: 217 33% 17%;
    --accent-foreground: 210 40% 95%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 210 40% 95%;
    --border: 217 33% 18%;
    --input: 217 33% 18%;
    --ring: 217 91% 60%;
    --radius: 0.5rem;
  }
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground font-mono; }
}
```

**Step 2: Update app/layout.tsx**

```typescript
// app/layout.tsx
import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';

const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Sim Results',
  description: 'EV Charging Simulation Results Viewer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${mono.variable} font-mono antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

**Step 3: Verify dark theme renders**

```bash
npm run dev
```
Expected: Deep navy background on localhost:3000.

**Step 4: Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat: apply dark technical theme with JetBrains Mono"
```

---

### Task 13: Landing page (URL loader)

**Files:**
- Modify: `app/page.tsx`
- Create: `components/LoadingScreen.tsx`

**Step 1: Write the LoadingScreen component**

```typescript
// components/LoadingScreen.tsx
export function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
```

**Step 2: Write the landing page**

```typescript
// app/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSimulationStore } from '@/store/simulationStore';
import { fetchResults } from '@/lib/apiClient';
import { enrichRows } from '@/lib/compute';
import apiConfig from '@/config/api.config.json';

export default function LandingPage() {
  const [url, setUrl] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const { setRows, setLoading, setError, setLoadedUrl, isLoading } = useSimulationStore();
  const router = useRouter();

  async function handleLoad() {
    if (!url.trim()) {
      setLocalError('Please enter a URL');
      return;
    }
    setLocalError(null);
    setLoading(true);
    setError(null);
    try {
      const raw = await fetchResults(apiConfig, url.trim());
      const enriched = enrichRows(raw);
      setRows(enriched);
      setLoadedUrl(url.trim());
      router.push('/dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setLocalError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <Card className="w-full max-w-lg border-slate-700 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-2xl text-white">Sim Results</CardTitle>
          <p className="text-sm text-muted-foreground">
            EV Charging Simulation Results Viewer
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-slate-400 uppercase tracking-wider">
              Results API URL
            </label>
            <Input
              placeholder="https://..."
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLoad()}
              className="bg-slate-800 border-slate-600 text-white"
            />
          </div>
          {localError && (
            <p className="text-red-400 text-sm">{localError}</p>
          )}
          <Button
            onClick={handleLoad}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Loading...' : 'Load Results'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add app/page.tsx components/LoadingScreen.tsx
git commit -m "feat: add landing page with URL loader"
```

---

### Task 14: Dashboard layout with sidebar and tab nav

**Files:**
- Create: `app/dashboard/layout.tsx`
- Create: `components/GlobalSidebar.tsx`
- Create: `components/TabNav.tsx`

**Step 1: Write GlobalSidebar**

```typescript
// components/GlobalSidebar.tsx
'use client';
import { useSimulationStore } from '@/store/simulationStore';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export function GlobalSidebar() {
  const { settings, updateSettings, rawRows, loadedUrl } = useSimulationStore();

  return (
    <aside className="w-64 min-h-screen bg-slate-950 border-r border-slate-800 p-4 flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-white">Sim Results</h1>
        {loadedUrl && (
          <p className="text-xs text-muted-foreground mt-1 truncate" title={loadedUrl}>
            {loadedUrl}
          </p>
        )}
        <Badge variant="outline" className="mt-2 text-xs border-slate-600 text-slate-400">
          {rawRows.length} configs
        </Badge>
      </div>

      {/* Demand Charge Controls */}
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-wider text-slate-400">Demand Charges</p>

        <div className="flex items-center justify-between">
          <Label className="text-sm text-slate-300">Apply Demand Charges</Label>
          <Switch
            checked={settings.applyDemandCharges}
            onCheckedChange={v => updateSettings({ applyDemandCharges: v })}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-slate-400">Demand Charge Rate ($/kW)</Label>
          <Input
            type="number"
            min={0}
            step={1}
            value={settings.demandChargeRate}
            onChange={e => updateSettings({ demandChargeRate: Number(e.target.value) })}
            disabled={!settings.applyDemandCharges}
            className="bg-slate-800 border-slate-600 text-white h-8 text-sm"
          />
        </div>

        {!settings.applyDemandCharges && (
          <p className="text-xs text-slate-500 italic">
            Monthly profit = sum of daily profits
          </p>
        )}
        {settings.applyDemandCharges && (
          <p className="text-xs text-slate-500 italic">
            Monthly profit = Σprofit − {settings.demandChargeRate}$/kW × peak 15m demand
          </p>
        )}
      </div>
    </aside>
  );
}
```

**Step 2: Write TabNav**

```typescript
// components/TabNav.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { label: 'Overview',      href: '/dashboard' },
  { label: 'Compare',       href: '/dashboard/compare' },
  { label: 'Tactical DCO',  href: '/dashboard/tactical-dco' },
  { label: 'Battery',       href: '/dashboard/battery-changes' },
  { label: 'Charger',       href: '/dashboard/charger-changes' },
];

export function TabNav() {
  const pathname = usePathname();
  return (
    <nav className="flex border-b border-slate-800 px-4 bg-slate-950">
      {TABS.map(tab => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            'px-4 py-3 text-sm transition-colors border-b-2 -mb-px',
            pathname === tab.href
              ? 'border-primary text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
```

**Step 3: Write dashboard layout**

```typescript
// app/dashboard/layout.tsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GlobalSidebar } from '@/components/GlobalSidebar';
import { TabNav } from '@/components/TabNav';
import { useSimulationStore } from '@/store/simulationStore';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const rawRows = useSimulationStore(s => s.rawRows);

  // Guard: redirect to landing if no data loaded
  useEffect(() => {
    if (rawRows.length === 0) {
      router.replace('/');
    }
  }, [rawRows.length, router]);

  if (rawRows.length === 0) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <GlobalSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TabNav />
        <main className="flex-1 overflow-auto p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add app/dashboard/layout.tsx components/GlobalSidebar.tsx components/TabNav.tsx
git commit -m "feat: add dashboard layout with global sidebar and tab navigation"
```

---

## Phase 6: Tab Implementations

### Task 15: Overview tab

**Files:**
- Create: `app/dashboard/page.tsx`
- Create: `lib/overview.ts`

**Step 1: Write overview data helper**

```typescript
// lib/overview.ts
import type { EnrichedRow } from './types';

export function computeOverviewData(rows: EnrichedRow[]) {
  if (rows.length === 0) return null;

  const ai = rows.filter(r => r.AI);
  const noAi = rows.filter(r => !r.AI);
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const sortedByProfit = [...rows].sort((a, b) => b.maximize_profit_score - a.maximize_profit_score);
  const sortedByDx = [...rows].sort((a, b) => (b.maximize_dx_score ?? 0) - (a.maximize_dx_score ?? 0));
  const sortedByAbsProfit = [...rows].sort((a, b) => b.profit - a.profit);

  return {
    totalConfigs: rows.length,
    bestByProfitScore: sortedByProfit[0],
    bestByDxScore: sortedByDx[0],
    highestAbsProfit: sortedByAbsProfit[0],
    top10: sortedByProfit.slice(0, 10),
    aiVsNoAi: {
      deltaProfit: avg(ai.map(r => r.profit)) - avg(noAi.map(r => r.profit)),
      deltaDx: avg(ai.filter(r => r.dx_score != null).map(r => r.dx_score as number))
               - avg(noAi.filter(r => r.dx_score != null).map(r => r.dx_score as number)),
      deltaWait: avg(ai.map(r => r.mean_wait_per_driver_rush_hour))
                 - avg(noAi.map(r => r.mean_wait_per_driver_rush_hour)),
      deltaUnmet: avg(ai.map(r => r.mean_unmet_rush_hour))
                  - avg(noAi.map(r => r.mean_unmet_rush_hour)),
      deltaPeak: avg(ai.map(r => r.max_power_demand_15m_rolling))
                 - avg(noAi.map(r => r.max_power_demand_15m_rolling)),
    },
  };
}
```

**Step 2: Write the Overview page**

```typescript
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
  if (!data) return null;

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

      {/* AI vs No-AI */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-sm text-slate-300">AI vs No-AI — Average Delta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            {[
              { label: 'Profit', value: aiVsNoAi.deltaProfit, fmt: formatCurrency, lowerBetter: false },
              { label: 'DX Score', value: aiVsNoAi.deltaDx, fmt: (v: number) => v.toFixed(1), lowerBetter: false },
              { label: 'Wait (Rush)', value: aiVsNoAi.deltaWait, fmt: (v: number) => v.toFixed(2) + 'min', lowerBetter: true },
              { label: 'Unmet (Rush)', value: aiVsNoAi.deltaUnmet, fmt: (v: number) => (v * 100).toFixed(2) + '%', lowerBetter: true },
              { label: 'Peak Power', value: aiVsNoAi.deltaPeak, fmt: formatKw, lowerBetter: true },
            ].map(({ label, value, fmt, lowerBetter }) => {
              const positive = lowerBetter ? value <= 0 : value >= 0;
              return (
                <div key={label} className="text-center">
                  <p className="text-xs text-slate-400 mb-1">{label}</p>
                  <p className={`text-lg font-bold ${positive ? 'text-green-400' : 'text-red-400'}`}>
                    {value >= 0 ? '+' : ''}{fmt(value)}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top 10 */}
      <Card className="bg-slate-900 border-slate-700">
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
```

**Step 3: Commit**

```bash
git add app/dashboard/page.tsx lib/overview.ts
git commit -m "feat: implement Overview tab"
```

---

### Task 16: Compare Table tab

**Files:**
- Create: `app/dashboard/compare/page.tsx`

**Step 1: Write the Compare Table page**

```typescript
// app/dashboard/compare/page.tsx
'use client';
import { useState, useMemo } from 'react';
import { useSimulationStore } from '@/store/simulationStore';
import { computeMonthlyProfit } from '@/lib/compute';
import { ScoreBar } from '@/components/ScoreBar';
import { AllocatorBadge } from '@/components/AllocatorBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { formatCurrency, formatKw, formatScore } from '@/lib/utils';
import type { EnrichedRow } from '@/lib/types';

const PAGE_SIZE = 20;

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

  // Group rows by month for monthly profit computation
  const rowsWithMonthly = useMemo(() => {
    const byMonth: Record<string, EnrichedRow[]> = {};
    rawRows.forEach(r => {
      (byMonth[r.monthKey] ??= []).push(r);
    });
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
    else { setSortKey(key); setSortDir('desc'); }
  }

  function exportCsv() {
    const headers = ['name', 'allocator', 'start_date', 'profit', 'monthly_profit', 'dx_score', 'profit_score', 'max_power_demand_15m_rolling'];
    const csv = [headers.join(','), ...sorted.map(r =>
      headers.map(h => (r as Record<string, unknown>)[h] ?? '').join(',')
    )].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'sim-results.csv'; a.click();
  }

  const Th = ({ label, sortable, k }: { label: string; sortable?: boolean; k?: string }) => (
    <th
      className={`text-left text-xs text-slate-400 pb-2 pr-4 whitespace-nowrap ${sortable ? 'cursor-pointer hover:text-white' : ''}`}
      onClick={() => sortable && k && toggleSort(k)}
    >
      {label} {sortable && k === sortKey ? (sortDir === 'desc' ? '↓' : '↑') : ''}
    </th>
  );

  return (
    <div className="space-y-4 max-w-full">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Compare Table</h2>
        <Button variant="outline" size="sm" onClick={exportCsv} className="border-slate-600">
          Export CSV
        </Button>
      </div>

      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400 w-24">Profit ←→ DX</span>
            <Slider
              value={[balance]}
              onValueChange={([v]) => setBalance(v)}
              min={0} max={100} step={5}
              className="flex-1"
            />
            <span className="text-xs text-slate-400 w-8">{balance}</span>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 sticky top-0">
            <tr>
              <Th label="Name" />
              <Th label="Allocator" />
              <Th label="Date" />
              <Th label="Profit/day" sortable k="profit" />
              <Th label="Monthly Profit" sortable k="monthly_profit" />
              <Th label="Peak 15m" sortable k="max_power_demand_15m_rolling" />
              <Th label="Opt Score" sortable k="optimization_score" />
              <Th label="Profit Score" sortable k="profit_score" />
              <Th label="DX Score" sortable k="dx_score" />
            </tr>
          </thead>
          <tbody>
            {pageRows.map(row => (
              <tr key={row._index} className="border-t border-slate-800 hover:bg-slate-800/50">
                <td className="py-2 pr-4 max-w-xs truncate text-white">{row.name}</td>
                <td className="py-2 pr-4"><AllocatorBadge allocator={row.allocator} /></td>
                <td className="py-2 pr-4 text-slate-400">{row.start_date}</td>
                <td className="py-2 pr-4 tabular-nums">{formatCurrency(row.profit)}</td>
                <td className="py-2 pr-4 tabular-nums">{formatCurrency(row.monthly_profit)}</td>
                <td className="py-2 pr-4 tabular-nums">{formatKw(row.max_power_demand_15m_rolling)}</td>
                <td className="py-2 pr-4 w-32"><ScoreBar value={row.optimization_score} /></td>
                <td className="py-2 pr-4 w-32"><ScoreBar value={row.profit_score} /></td>
                <td className="py-2 pr-4 w-32"><ScoreBar value={row.dx_score} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>{sorted.length} configurations</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="border-slate-600">
            Previous
          </Button>
          <span className="px-2 py-1">Page {page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="border-slate-600">
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/dashboard/compare/page.tsx
git commit -m "feat: implement Compare Table tab with sort, pagination, CSV export"
```

---

### Task 17: Tactical DCO tab

**Files:**
- Create: `app/dashboard/tactical-dco/page.tsx`

**Step 1: Write the Tactical DCO page**

```typescript
// app/dashboard/tactical-dco/page.tsx
'use client';
import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter,
} from 'recharts';
import { useSimulationStore } from '@/store/simulationStore';
import { computeMonthlyProfit } from '@/lib/compute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatKw } from '@/lib/utils';
import { LOAD_LABELS, ALLOCATOR_COLORS } from '@/constants';

export default function TacticalDCOPage() {
  const { rawRows, settings } = useSimulationStore();
  const [selectedAllocator, setSelectedAllocator] = useState('AI');

  const allocators = useMemo(() =>
    Array.from(new Set(rawRows.map(r => r.allocator))).sort(), [rawRows]);

  const loads = useMemo(() =>
    Array.from(new Set(rawRows.map(r => r.duration_days))).sort(), [rawRows]);

  // Build profit/DX by grid_input, split by DCO on/off
  const chartData = useMemo(() => {
    const filtered = rawRows.filter(r => r.allocator === selectedAllocator);
    const gridInputs = Array.from(new Set(filtered.map(r => r.grid_input))).sort((a, b) => a - b);

    return gridInputs.map(gi => {
      const rows = filtered.filter(r => r.grid_input === gi);
      const dcoOn = rows.filter(r => r.DCO);
      const dcoOff = rows.filter(r => !r.DCO);

      const avgProfit = (arr: typeof rows) => {
        if (!arr.length) return null;
        const byMonth: Record<string, typeof rows> = {};
        arr.forEach(r => (byMonth[r.monthKey] ??= []).push(r));
        const monthlyProfits = Object.values(byMonth).map(mRows =>
          computeMonthlyProfit(mRows.map(r => r.profit), mRows.map(r => r.max_power_demand_15m_rolling), settings)
        );
        return monthlyProfits.reduce((a, b) => a + b, 0) / monthlyProfits.length;
      };

      const avgDx = (arr: typeof rows) => {
        const scores = arr.map(r => r.dx_score).filter(Boolean) as number[];
        return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      };

      return {
        grid_input: gi,
        dco_on_profit: avgProfit(dcoOn),
        dco_off_profit: avgProfit(dcoOff),
        dco_on_dx: avgDx(dcoOn),
        dco_off_dx: avgDx(dcoOff),
      };
    });
  }, [rawRows, selectedAllocator, settings]);

  const allocatorColor = ALLOCATOR_COLORS[selectedAllocator] ?? '#3b82f6';

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
                  ? 'border-primary text-white bg-primary/20'
                  : 'border-slate-600 text-slate-400 hover:text-white'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Profit: DCO ON vs OFF */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-sm text-slate-300">Monthly Profit: DCO ON vs DCO OFF</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="grid_input" tickFormatter={v => `${v}kW`} stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tickFormatter={formatCurrency} stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6 }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(v: number) => [formatCurrency(v)]}
              />
              <Legend />
              <Line type="monotone" dataKey="dco_on_profit" name="DCO ON" stroke={allocatorColor} strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="dco_off_profit" name="DCO OFF" stroke={allocatorColor} strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* DX: DCO ON vs OFF */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-sm text-slate-300">DX Score: DCO ON vs DCO OFF</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="grid_input" tickFormatter={v => `${v}kW`} stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Legend />
              <Line type="monotone" dataKey="dco_on_dx" name="DCO ON" stroke={allocatorColor} strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="dco_off_dx" name="DCO OFF" stroke={allocatorColor} strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Create tab route stubs** (needed for Next.js routing)

```bash
mkdir -p app/dashboard/tactical-dco
```

**Step 3: Commit**

```bash
git add app/dashboard/tactical-dco/page.tsx
git commit -m "feat: implement Tactical DCO tab with profit and DX line charts"
```

---

### Task 18: Battery Changes tab

**Files:**
- Create: `app/dashboard/battery-changes/page.tsx`
- Create: `lib/batteryScenarios.ts`

**Step 1: Write battery scenario builder**

```typescript
// lib/batteryScenarios.ts
import type { EnrichedRow } from './types';
import { computeMonthlyProfit } from './compute';
import type { GlobalSettings } from './types';
import { SCENARIO_COLORS } from '@/constants';

export interface BatteryScenario {
  id: string;
  btmName: string;
  label: string;
  color: string;
  rows: EnrichedRow[];
  avgProfit: number;
  avgDx: number | null;
  monthlyProfit: number;
  totalEnergy: number;
  energyFromStorage: number;
  energyIntoStorage: number;
}

export function buildBatteryScenarios(rows: EnrichedRow[], settings: GlobalSettings): BatteryScenario[] {
  const aiRows = rows.filter(r => r.AI && r.BTM_name);
  const byBtm: Record<string, EnrichedRow[]> = {};
  aiRows.forEach(r => {
    const key = r.BTM_name as string;
    (byBtm[key] ??= []).push(r);
  });

  return Object.entries(byBtm).map(([btmName, scenarioRows], i) => {
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const byMonth: Record<string, EnrichedRow[]> = {};
    scenarioRows.forEach(r => (byMonth[r.monthKey] ??= []).push(r));
    const monthlyProfits = Object.values(byMonth).map(mRows =>
      computeMonthlyProfit(mRows.map(r => r.profit), mRows.map(r => r.max_power_demand_15m_rolling), settings)
    );
    const monthlyProfit = monthlyProfits.reduce((a, b) => a + b, 0) / (monthlyProfits.length || 1);
    const dxScores = scenarioRows.map(r => r.dx_score).filter(Boolean) as number[];

    return {
      id: btmName,
      btmName,
      label: btmName,
      color: SCENARIO_COLORS[i % SCENARIO_COLORS.length],
      rows: scenarioRows,
      avgProfit: avg(scenarioRows.map(r => r.profit)),
      avgDx: dxScores.length ? avg(dxScores) : null,
      monthlyProfit,
      totalEnergy: scenarioRows.reduce((s, r) => s + r.total_energy_out, 0),
      energyFromStorage: avg(scenarioRows.map(r => r.energy_from_storage)),
      energyIntoStorage: avg(scenarioRows.map(r => r.energy_into_storage)),
    };
  });
}
```

**Step 2: Write Battery Changes page**

```typescript
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
      <div className="flex items-center justify-center h-64 text-slate-400">
        No battery (BTM_name) data found in loaded results.
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

  const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader><CardTitle className="text-sm text-slate-300">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h2 className="text-xl font-bold text-white">Battery Changes</h2>

      <div className="grid grid-cols-2 gap-6">
        <ChartCard title="Monthly Profit by BESS Config">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={profitData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tickFormatter={formatCurrency} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155' }}
                formatter={(v: number) => [formatCurrency(v), 'Monthly Profit']}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {profitData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Avg DX Score by BESS Config">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dxData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
              <Bar dataKey="value" name="DX Score" radius={[4, 4, 0, 0]}>
                {dxData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Energy Storage Flow (avg per day)">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={energyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis unit=" kWh" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
            <Bar dataKey="from" name="From Storage" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="into" name="Into Storage" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Scenario Summary Table */}
      <Card className="bg-slate-900 border-slate-700">
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
                <tr key={s.id} className="border-b border-slate-800">
                  <td className="py-2">
                    <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(s.avgProfit)}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(s.monthlyProfit)}</td>
                  <td className="py-2 text-right tabular-nums">{s.avgDx?.toFixed(1) ?? 'N/A'}</td>
                  <td className="py-2 text-right tabular-nums">{s.totalEnergy.toFixed(0)} kWh</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add app/dashboard/battery-changes/page.tsx lib/batteryScenarios.ts
git commit -m "feat: implement Battery Changes tab with BESS scenario charts"
```

---

### Task 19: Charger Changes tab

**Files:**
- Create: `app/dashboard/charger-changes/page.tsx`
- Create: `lib/chargerScenarios.ts`

**Step 1: Write charger scenario builder**

```typescript
// lib/chargerScenarios.ts
import type { EnrichedRow } from './types';
import { computeMonthlyProfit } from './compute';
import type { GlobalSettings } from './types';
import { parseChargers } from './compute';
import { SCENARIO_COLORS } from '@/constants';

export interface ChargerScenario {
  id: string;
  rawChargers: string;
  label: string;
  shortLabel: string;
  color: string;
  rows: EnrichedRow[];
  avgProfit: number;
  avgDx: number | null;
  monthlyProfit: number;
  totalEnergy: number;
}

export function buildChargerScenarios(rows: EnrichedRow[], settings: GlobalSettings): ChargerScenario[] {
  const aiRows = rows.filter(r => r.AI);
  const byCharger: Record<string, EnrichedRow[]> = {};
  aiRows.forEach(r => { (byCharger[r.chargers] ??= []).push(r); });

  return Object.entries(byCharger).map(([chargers, scenarioRows], i) => {
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const byMonth: Record<string, EnrichedRow[]> = {};
    scenarioRows.forEach(r => (byMonth[r.monthKey] ??= []).push(r));
    const monthlyProfits = Object.values(byMonth).map(mRows =>
      computeMonthlyProfit(mRows.map(r => r.profit), mRows.map(r => r.max_power_demand_15m_rolling), settings)
    );
    const monthlyProfit = monthlyProfits.reduce((a, b) => a + b, 0) / (monthlyProfits.length || 1);
    const dxScores = scenarioRows.map(r => r.dx_score).filter(Boolean) as number[];
    const label = parseChargers(chargers);

    return {
      id: chargers,
      rawChargers: chargers,
      label,
      shortLabel: label.slice(0, 20),
      color: SCENARIO_COLORS[i % SCENARIO_COLORS.length],
      rows: scenarioRows,
      avgProfit: avg(scenarioRows.map(r => r.profit)),
      avgDx: dxScores.length ? avg(dxScores) : null,
      monthlyProfit,
      totalEnergy: scenarioRows.reduce((s, r) => s + r.total_energy_out, 0),
    };
  });
}
```

**Step 2: Write Charger Changes page**

```typescript
// app/dashboard/charger-changes/page.tsx
'use client';
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter } from 'recharts';
import { useSimulationStore } from '@/store/simulationStore';
import { buildChargerScenarios } from '@/lib/chargerScenarios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

export default function ChargerChangesPage() {
  const { rawRows, settings } = useSimulationStore();
  const scenarios = useMemo(() => buildChargerScenarios(rawRows, settings), [rawRows, settings]);

  if (scenarios.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        No charger configuration data found.
      </div>
    );
  }

  const profitData = scenarios.map(s => ({ name: s.shortLabel, value: s.monthlyProfit, color: s.color }));
  const scatterData = scenarios.map(s => ({ name: s.label, x: s.avgDx, y: s.monthlyProfit, color: s.color }));

  const best = {
    profit: scenarios.reduce((a, b) => a.monthlyProfit > b.monthlyProfit ? a : b),
    dx: scenarios.reduce((a, b) => (a.avgDx ?? 0) > (b.avgDx ?? 0) ? a : b),
    energy: scenarios.reduce((a, b) => a.totalEnergy > b.totalEnergy ? a : b),
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h2 className="text-xl font-bold text-white">Charger Changes</h2>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Best Profit', scenario: best.profit, value: formatCurrency(best.profit.monthlyProfit) },
          { label: 'Best DX',     scenario: best.dx,     value: best.dx.avgDx?.toFixed(1) ?? 'N/A' },
          { label: 'Best Energy', scenario: best.energy, value: best.energy.totalEnergy.toFixed(0) + ' kWh' },
        ].map(({ label, scenario, value }) => (
          <Card key={label} className="bg-slate-900 border-slate-700">
            <CardContent className="pt-4">
              <p className="text-xs text-slate-400 uppercase">{label}</p>
              <p className="text-xl font-bold text-white mt-1">{value}</p>
              <p className="text-xs text-slate-400 mt-1 truncate">{scenario.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Monthly Profit Bar */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader><CardTitle className="text-sm text-slate-300">Monthly Profit by Charger Layout</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={profitData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tickFormatter={formatCurrency} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155' }}
                  formatter={(v: number) => [formatCurrency(v), 'Monthly Profit']}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {profitData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* DX vs Profit Scatter */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader><CardTitle className="text-sm text-slate-300">DX Score vs Monthly Profit</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="x" name="DX Score" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis dataKey="y" name="Monthly Profit" tickFormatter={formatCurrency} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155' }}
                  formatter={(v: number, name: string) => [
                    name === 'y' ? formatCurrency(v) : v?.toFixed(1), name === 'y' ? 'Monthly Profit' : 'DX Score'
                  ]}
                />
                {scenarios.map(s => (
                  <Scatter
                    key={s.id}
                    name={s.label}
                    data={[{ x: s.avgDx, y: s.monthlyProfit }]}
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
```

**Step 3: Commit**

```bash
git add app/dashboard/charger-changes/page.tsx lib/chargerScenarios.ts
git commit -m "feat: implement Charger Changes tab with layout comparison charts"
```

---

## Phase 7: Final Polish

### Task 20: Jest configuration

**Files:**
- Create: `jest.config.ts`
- Create: `jest.setup.ts`

**Step 1: Add Jest config**

```bash
npm install --save-dev jest jest-environment-jsdom ts-jest @testing-library/react @testing-library/jest-dom
```

```typescript
// jest.config.ts
import type { Config } from 'jest';
const config: Config = {
  testEnvironment: 'node',
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react' } }] },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
};
export default config;
```

**Step 2: Run all tests**

```bash
npx jest
```
Expected: All tests PASS.

**Step 3: Final commit**

```bash
git add jest.config.ts
git commit -m "feat: add Jest config and run all tests green"
```

---

### Task 21: Verify full dev build

**Step 1: Run type check**

```bash
npx tsc --noEmit
```
Expected: No type errors.

**Step 2: Run dev server and manually verify**

```bash
npm run dev
```
- Navigate to http://localhost:3000
- Enter any JSON URL (or use a local server), click Load
- Verify dashboard tabs render without errors

**Step 3: Build for production**

```bash
npm run build
```
Expected: Build succeeds with no errors.

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: verify full build and type check"
```

---

## Summary

| Phase | Tasks | Deliverable |
|-------|-------|-------------|
| 1 | 1 | Next.js + Tailwind + shadcn/ui scaffold |
| 2 | 2-3 | Types, constants |
| 3 | 4-7 | API client, CORS proxy, enrichment (TDD), Zustand store |
| 4 | 8-11 | ScoreBar, KPICard, AllocatorBadge, utils |
| 5 | 12-14 | Theme, landing page, dashboard layout |
| 6 | 15-19 | 5 tabs: Overview, Compare, Tactical DCO, Battery, Charger |
| 7 | 20-21 | Jest config, type check, production build |

**Demand charge formula (implemented in `lib/compute.ts`):**
- OFF: `monthly_profit = SUM(profit in month)`
- ON: `monthly_profit = SUM(profit in month) − demandChargeRate × MAX(max_power_demand_15m_rolling in month)`

**API config:** Replace `config/api.config.json` at any time — no code changes needed.
