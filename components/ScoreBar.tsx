// components/ScoreBar.tsx
import { cn } from '@/lib/utils';

interface ScoreBarProps {
  value: number | null;
  max?: number;
  colorOverride?: string;
  showLabel?: boolean;
  className?: string;
}

export function ScoreBar({ value, max = 100, colorOverride, showLabel = true, className }: ScoreBarProps) {
  if (value === null) {
    return <span className="text-xs" style={{ color: '#686B6D' }}>N/A</span>;
  }
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  // Use brand limon for high scores, amber for mid, red for low
  const color = colorOverride ?? (pct >= 70 ? '#FAFA2D' : pct >= 40 ? '#f59e0b' : '#ef4444');

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#141520' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {showLabel && (
        <span
          className="text-xs tabular-nums w-10 text-right"
          style={{ color: '#686B6D', fontFamily: 'Clash Grotesk, sans-serif', fontWeight: 300 }}
        >
          {value.toFixed(1)}
        </span>
      )}
    </div>
  );
}
