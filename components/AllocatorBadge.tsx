// components/AllocatorBadge.tsx
import { Badge } from '@/components/ui/badge';
import { ALLOCATOR_COLORS } from '@/constants';

export function AllocatorBadge({ allocator }: { allocator: string }) {
  const color = ALLOCATOR_COLORS[allocator] ?? '#6b7280';
  return (
    <Badge
      style={{ backgroundColor: color + '22', color, borderColor: color + '55' }}
      variant="outline"
      className="text-xs font-mono"
    >
      {allocator}
    </Badge>
  );
}
