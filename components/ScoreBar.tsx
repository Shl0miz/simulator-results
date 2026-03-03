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
    return <span className="text-muted-foreground text-xs">N/A</span>;
  }
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const color = colorOverride ?? (pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444');

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {showLabel && (
        <span className="text-xs tabular-nums w-10 text-right text-muted-foreground">
          {value.toFixed(1)}
        </span>
      )}
    </div>
  );
}
