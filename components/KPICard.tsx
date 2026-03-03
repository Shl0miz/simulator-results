// components/KPICard.tsx
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  delta?: number;
  deltaLabel?: string;
  className?: string;
}

export function KPICard({ title, value, subtitle, delta, deltaLabel, className }: KPICardProps) {
  const deltaPositive = delta != null && delta >= 0;
  return (
    <Card className={cn('bg-slate-900 border-slate-700', className)}>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{title}</p>
        <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-1 truncate">{subtitle}</p>}
        {delta != null && (
          <p className={cn('text-sm font-medium mt-1', deltaPositive ? 'text-green-400' : 'text-red-400')}>
            {deltaPositive ? '+' : ''}{delta.toFixed(1)} {deltaLabel}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
