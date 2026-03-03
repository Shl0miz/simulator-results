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
import type { ApiConfig } from '@/lib/types';
import apiConfigJson from '@/config/api.config.json';

const apiConfig = apiConfigJson as ApiConfig;

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
    <div className="min-h-screen flex items-center justify-center p-8">
      <Card className="w-full max-w-lg border-slate-700" style={{ background: 'oklch(0.13 0.03 265)' }}>
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
              className="border-slate-600 text-white"
              style={{ background: 'oklch(0.16 0.03 265)' }}
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
