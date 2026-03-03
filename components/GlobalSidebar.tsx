// components/GlobalSidebar.tsx
'use client';
import { useEffect, useState } from 'react';
import { useSimulationStore } from '@/store/simulationStore';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type HealthStatus = 'checking' | 'healthy' | 'degraded' | 'down';

function HealthDot({ status }: { status: HealthStatus }) {
  const cfg: Record<HealthStatus, { color: string; label: string }> = {
    checking: { color: '#686B6D', label: 'Checking...' },
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
    <aside
      className="w-64 min-h-screen flex flex-col gap-6 p-5"
      style={{ background: '#04040B', borderRight: '1px solid #44474F' }}
    >
      {/* Brand Header */}
      <div className="pt-1">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p
              className="text-[10px] tracking-[0.2em] uppercase mb-0.5"
              style={{ color: '#686B6D', fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif' }}
            >
              evPower
            </p>
            <h1
              className="text-base tracking-widest uppercase"
              style={{
                color: '#EDF0F3',
                fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif',
                fontWeight: 300,
                letterSpacing: '0.12em',
              }}
            >
              Sim Results
            </h1>
          </div>
          <HealthDot status={health} />
        </div>
        {loadedUrl && (
          <p
            className="text-[10px] truncate mt-1"
            style={{ color: '#686B6D' }}
            title={loadedUrl}
          >
            {loadedUrl}
          </p>
        )}
        <div
          className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px]"
          style={{ background: '#141520', color: '#686B6D', border: '1px solid #44474F' }}
        >
          <span style={{ color: '#FAFA2D' }}>{rawRows.length}</span>
          <span>configs</span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid #44474F' }} />

      {/* Demand Charge Controls */}
      <div className="space-y-4">
        <p
          className="text-[9px] tracking-[0.2em] uppercase"
          style={{ color: '#686B6D', fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif' }}
        >
          Demand Charges
        </p>

        <div className="flex items-center justify-between">
          <Label className="text-xs" style={{ color: '#B1B3B4' }}>Apply Charges</Label>
          <Switch
            checked={settings.applyDemandCharges}
            onCheckedChange={v => updateSettings({ applyDemandCharges: v })}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] tracking-wider uppercase" style={{ color: '#686B6D' }}>
            Rate ($/kW)
          </Label>
          <Input
            type="number"
            min={0}
            step={1}
            value={settings.demandChargeRate}
            onChange={e => updateSettings({ demandChargeRate: Number(e.target.value) })}
            disabled={!settings.applyDemandCharges}
            className="h-8 text-sm border-0"
            style={{
              background: '#141520',
              color: '#EDF0F3',
              border: '1px solid #44474F',
              outline: 'none',
            }}
          />
        </div>

        <p className="text-[10px] leading-relaxed" style={{ color: '#686B6D' }}>
          {!settings.applyDemandCharges
            ? 'Monthly profit = Σ daily profits'
            : `Monthly profit = Σprofit − ${settings.demandChargeRate}$/kW × peak 15m`
          }
        </p>
      </div>
    </aside>
  );
}
