// app/dashboard/layout.tsx
'use client';
import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GlobalSidebar } from '@/components/GlobalSidebar';
import { TabNav } from '@/components/TabNav';
import { useSimulationStore } from '@/store/simulationStore';
import { fetchGroupResults, fetchJobResults } from '@/lib/apiClient';
import type { EvPowerApiConfig } from '@/lib/apiClient';
import { enrichRows } from '@/lib/compute';
import apiConfigJson from '@/config/api.config.json';
import { Loader2 } from 'lucide-react';

const apiConfig = apiConfigJson as EvPowerApiConfig;

/** Reads URL params and auto-loads data if store is empty */
function AutoLoader() {
  const searchParams = useSearchParams();
  const { rawRows, setRows, setLoading, setLoadedUrl, setSourceKey, isLoading } = useSimulationStore();
  const didAttempt = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (rawRows.length > 0 || didAttempt.current || isLoading) return;
    const group = searchParams.get('group');
    const job = searchParams.get('job');
    if (!group && !job) {
      // No params — redirect to landing
      router.replace('/');
      return;
    }
    didAttempt.current = true;
    setLoading(true);

    const load = group
      ? fetchGroupResults(apiConfig, group)
      : fetchJobResults(apiConfig, job!);

    load
      .then(raw => {
        const enriched = enrichRows(raw);
        setRows(enriched);
        setLoadedUrl(group ? `group: ${group}` : `job: ${job}`);
        setSourceKey(group ? `group:${group}` : `job:${job!}`);
      })
      .catch(() => {
        // Failed to load — go back to landing
        router.replace('/');
      })
      .finally(() => setLoading(false));
  }, [searchParams, rawRows.length, isLoading, router, setRows, setLoading, setLoadedUrl, setSourceKey]);

  return null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const rawRows = useSimulationStore(s => s.rawRows);
  const isLoading = useSimulationStore(s => s.isLoading);

  // Show loading overlay while auto-loading from URL
  if (rawRows.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen gap-3" style={{ background: '#04040B', color: '#686B6D' }}>
        <Suspense fallback={null}>
          <AutoLoader />
        </Suspense>
        {isLoading && (
          <>
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#FAFA2D' }} />
            <span className="text-sm tracking-widest uppercase" style={{ fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif', fontWeight: 300, fontSize: '0.7rem', letterSpacing: '0.15em' }}>Loading simulation data...</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#04040B' }}>
      <Suspense fallback={null}>
        <AutoLoader />
      </Suspense>
      <GlobalSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Suspense fallback={<nav className="h-11" style={{ background: '#04040B', borderBottom: '1px solid #44474F' }} />}>
          <TabNav />
        </Suspense>
        <main className="flex-1 overflow-auto p-6" style={{ background: '#04040B' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
