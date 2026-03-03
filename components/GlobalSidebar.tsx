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
    <aside className="w-64 min-h-screen border-r border-slate-800 p-4 flex flex-col gap-6"
           style={{ background: 'oklch(0.09 0.02 265)' }}>
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
