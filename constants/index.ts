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
