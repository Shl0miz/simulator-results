// store/simulationStore.ts
'use client';
import { create } from 'zustand';
import type { EnrichedRow, GlobalSettings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/constants';

interface SimulationStore {
  rawRows: EnrichedRow[];
  isLoading: boolean;
  error: string | null;
  loadedUrl: string | null;
  settings: GlobalSettings;

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
