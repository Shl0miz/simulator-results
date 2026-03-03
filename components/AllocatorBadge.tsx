// components/AllocatorBadge.tsx
import { ALLOCATOR_COLORS } from '@/constants';

export function AllocatorBadge({ allocator }: { allocator: string }) {
  const color = ALLOCATOR_COLORS[allocator] ?? '#686B6D';
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] tracking-wider uppercase"
      style={{
        backgroundColor: color + '18',
        color,
        border: `1px solid ${color}44`,
        fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif',
        fontWeight: 400,
      }}
    >
      {allocator}
    </span>
  );
}
