// components/KPICard.tsx
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
    <div
      className={cn('p-4 rounded', className)}
      style={{ background: '#0D0E14', border: '1px solid #44474F' }}
    >
      <p
        className="text-[9px] tracking-[0.18em] uppercase mb-2"
        style={{ color: '#686B6D', fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif' }}
      >
        {title}
      </p>
      <p
        className="tabular-nums leading-none"
        style={{
          color: '#EDF0F3',
          fontFamily: 'Clash Grotesk, sans-serif',
          fontWeight: 200,
          fontSize: '1.75rem',
        }}
      >
        {value}
      </p>
      {subtitle && (
        <p className="text-xs mt-1.5 truncate" style={{ color: '#686B6D' }}>
          {subtitle}
        </p>
      )}
      {delta != null && (
        <p
          className="text-sm font-medium mt-1"
          style={{ color: deltaPositive ? '#22c55e' : '#ef4444' }}
        >
          {deltaPositive ? '+' : ''}{delta.toFixed(1)} {deltaLabel}
        </p>
      )}
    </div>
  );
}
