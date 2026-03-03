// app/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSimulationStore } from '@/store/simulationStore';
import { fetchGroupResults, fetchJobResults, fetchFromUrl } from '@/lib/apiClient';
import { enrichRows } from '@/lib/compute';
import apiConfigJson from '@/config/api.config.json';
import type { EvPowerApiConfig } from '@/lib/apiClient';

const apiConfig = apiConfigJson as EvPowerApiConfig;

type Mode = 'group' | 'job' | 'url';

export default function LandingPage() {
  const [mode, setMode] = useState<Mode>('group');
  const [value, setValue] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const { setRows, setLoading, setError, setLoadedUrl, isLoading } = useSimulationStore();
  const router = useRouter();

  async function handleLoad() {
    const input = value.trim();
    if (!input) {
      setLocalError('Please enter a value');
      return;
    }
    setLocalError(null);
    setLoading(true);
    setError(null);

    try {
      let raw;
      if (mode === 'group') {
        raw = await fetchGroupResults(apiConfig, input);
        setLoadedUrl(`group: ${input}`);
      } else if (mode === 'job') {
        raw = await fetchJobResults(apiConfig, input);
        setLoadedUrl(`job: ${input}`);
      } else {
        raw = await fetchFromUrl(input, apiConfig.fieldMap);
        setLoadedUrl(input);
      }

      const enriched = enrichRows(raw);
      setRows(enriched);
      router.push('/dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setLocalError(msg);
    } finally {
      setLoading(false);
    }
  }

  const modeConfig: Record<Mode, { label: string; placeholder: string; hint: string }> = {
    group: {
      label: 'Group Name',
      placeholder: 'e.g. my-simulation-group',
      hint: 'Loads all completed jobs in the group',
    },
    job: {
      label: 'Job ID',
      placeholder: 'e.g. 550e8400-e29b-41d4-a716-446655440000',
      hint: 'Loads a single simulation job by UUID',
    },
    url: {
      label: 'Custom URL',
      placeholder: 'https://api.simulation.evpower.ai/simulate/...',
      hint: 'Advanced: fetch from any endpoint directly',
    },
  };

  const { label, placeholder, hint } = modeConfig[mode];

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-4">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white tracking-tight">Sim Results</h1>
          <p className="text-slate-400 text-sm mt-1">evPower Simulation Results Viewer</p>
        </div>

        <Card className="border-slate-700" style={{ background: 'oklch(0.13 0.03 265)' }}>
          <CardContent className="pt-6 space-y-4">
            {/* Mode selector */}
            <div className="flex rounded-lg overflow-hidden border border-slate-700">
              {(['group', 'job', 'url'] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setValue(''); setLocalError(null); }}
                  className={`flex-1 py-2 text-xs font-medium uppercase tracking-wider transition-colors ${
                    mode === m
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  style={mode !== m ? { background: 'oklch(0.16 0.03 265)' } : undefined}
                >
                  {m === 'group' ? 'Group' : m === 'job' ? 'Job ID' : 'URL'}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400 uppercase tracking-wider">{label}</label>
              <Input
                placeholder={placeholder}
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLoad()}
                className="border-slate-600 text-white"
                style={{ background: 'oklch(0.16 0.03 265)' }}
              />
              <p className="text-xs text-slate-500">{hint}</p>
            </div>

            {localError && (
              <div className="rounded border border-red-800 bg-red-950/40 px-3 py-2">
                <p className="text-red-400 text-sm">{localError}</p>
              </div>
            )}

            <Button
              onClick={handleLoad}
              disabled={isLoading || !value.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Loading...
                </span>
              ) : (
                'Load Results'
              )}
            </Button>

            {/* API info */}
            <p className="text-xs text-slate-600 text-center">
              {apiConfig.baseUrl}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
