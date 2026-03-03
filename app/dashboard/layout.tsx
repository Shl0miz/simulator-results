// app/dashboard/layout.tsx
'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GlobalSidebar } from '@/components/GlobalSidebar';
import { TabNav } from '@/components/TabNav';
import { JobsDrawer } from '@/components/JobsDrawer';
import { useSimulationStore } from '@/store/simulationStore';
import { fetchGroupResults, fetchJobResults } from '@/lib/apiClient';
import type { EvPowerApiConfig } from '@/lib/apiClient';
import { enrichRows } from '@/lib/compute';
import apiConfigJson from '@/config/api.config.json';
import { Loader2, ChevronDown, Database } from 'lucide-react';

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
    const groups = searchParams.get('groups');
    if (!group && !job && !groups) {
      router.replace('/');
      return;
    }
    didAttempt.current = true;
    setLoading(true);

    let load: Promise<import('@/lib/types').SimulationResult[]>;

    if (groups) {
      const groupNames = groups.split(',').map(decodeURIComponent);
      load = Promise.all(groupNames.map(g => fetchGroupResults(apiConfig, g)))
        .then(all => all.flat()) as Promise<import('@/lib/types').SimulationResult[]>;
    } else if (group) {
      load = fetchGroupResults(apiConfig, group);
    } else {
      load = fetchJobResults(apiConfig, job!);
    }

    load
      .then(raw => {
        const enriched = enrichRows(raw);
        setRows(enriched);
        if (groups) {
          const groupNames = groups.split(',').map(decodeURIComponent);
          setLoadedUrl(`${groupNames.length} groups`);
          setSourceKey(`groups:${groups}`);
        } else if (group) {
          setLoadedUrl(`group: ${group}`);
          setSourceKey(`group:${group}`);
        } else {
          setLoadedUrl(`job: ${job}`);
          setSourceKey(`job:${job!}`);
        }
      })
      .catch(() => { router.replace('/'); })
      .finally(() => setLoading(false));
  }, [searchParams, rawRows.length, isLoading, router, setRows, setLoading, setLoadedUrl, setSourceKey]);

  return null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const rawRows = useSimulationStore(s => s.rawRows);
  const isLoading = useSimulationStore(s => s.isLoading);
  const sourceKey = useSimulationStore(s => s.sourceKey);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
            <span className="tracking-widest uppercase" style={{ fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif', fontWeight: 300, fontSize: '0.65rem', letterSpacing: '0.15em' }}>
              Loading simulation data...
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#04040B' }}>
      <Suspense fallback={null}>
        <AutoLoader />
      </Suspense>

      {/* Slide-down drawer overlay */}
      <div
        className="fixed inset-0 z-50 transition-transform duration-300 ease-in-out"
        style={{ transform: drawerOpen ? 'translateY(0)' : 'translateY(-100%)' }}
      >
        <JobsDrawer onClose={() => setDrawerOpen(false)} />
      </div>

      {/* Dataset header strip — click to pull down job browser */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="flex items-center gap-2 px-4 h-8 w-full shrink-0 transition-colors hover:bg-[#0D0E14] group"
        style={{ borderBottom: '1px solid #44474F', background: '#04040B', textAlign: 'left' }}
      >
        <Database className="w-3 h-3 shrink-0" style={{ color: '#FAFA2D' }} />
        <span
          className="flex-1 text-[10px] truncate tracking-wider"
          style={{ color: '#686B6D', fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif', letterSpacing: '0.08em' }}
        >
          {sourceKey ?? 'No dataset'}
        </span>
        <span className="text-[9px] tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#FAFA2D' }}>
          Change ↓
        </span>
        <ChevronDown className="w-3 h-3 shrink-0" style={{ color: '#44474F' }} />
      </button>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
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
    </div>
  );
}
