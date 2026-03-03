// components/GlobalSidebar.tsx
'use client';
import { useEffect, useState } from 'react';
import { useSimulationStore } from '@/store/simulationStore';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

type HealthStatus = 'checking' | 'healthy' | 'degraded' | 'down';

function HealthDot({ status }: { status: HealthStatus }) {
  const cfg: Record<HealthStatus, { color: string; label: string }> = {
    checking: { color: '#6b7280', label: 'Checking...' },
    healthy:  { color: '#22c55e', label: 'API Online' },
    degraded: { color: '#f59e0b', label: 'Degraded' },
    down:     { color: '#ef4444', label: 'API Offline' },
  };
  const { color, label } = cfg[status];
  return (
    <div className="flex items-center gap-1.5" title={label}>
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{
          backgroundColor: color,
          boxShadow: status === 'healthy' ? `0 0 6px ${color}` : undefined,
          animation: status === 'checking' ? undefined : 'none',
        }}
      />
      <span className="text-xs" style={{ color }}>{label}</span>
    </div>
  );
}

export function GlobalSidebar() {
  const { settings, updateSettings, rawRows, loadedUrl } = useSimulationStore();
  const [health, setHealth] = useState<HealthStatus>('checking');

  useEffect(() => {
    let active = true;

    async function check() {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      try {
        const res = await fetch(
          `/api/fetch-results?url=${encodeURIComponent('https://api.simulation.evpower.ai/health')}`,
          { signal: ctrl.signal }
        );
        clearTimeout(timer);
        if (!active) return;
        setHealth(res.ok ? 'healthy' : 'degraded');
      } catch {
        clearTimeout(timer);
        if (active) setHealth('down');
      }
    }

    check();
    const interval = setInterval(check, 2000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  return (
    <aside className="w-64 min-h-screen border-r border-slate-800 p-4 flex flex-col gap-6"
           style={{ background: 'oklch(0.09 0.02 265)' }}>
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-bold text-white">Sim Results</h1>
          <HealthDot status={health} />
        </div>
        {loadedUrl && (
          <p className="text-xs text-muted-foreground truncate" title={loadedUrl}>
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
          <Label className="text-xs text-slate-400">Rate ($/kW)</Label>
          <Input
            type="number"
            min={0}
            step={1}
            value={settings.demandChargeRate}
            onChange={e => updateSettings({ demandChargeRate: Number(e.target.value) })}
            disabled={!settings.applyDemandCharges}
            className="border-slate-600 text-white h-8 text-sm"
            style={{ background: 'oklch(0.16 0.03 265)' }}
          />
        </div>

        {!settings.applyDemandCharges && (
          <p className="text-xs text-slate-500 italic">
            Monthly profit = Σ daily profits
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
