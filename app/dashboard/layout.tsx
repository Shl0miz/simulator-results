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
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
