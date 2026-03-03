// components/TabNav.tsx
'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { label: 'Overview',     href: '/dashboard' },
  { label: 'Compare',      href: '/dashboard/compare' },
  { label: 'Tactical DCO', href: '/dashboard/tactical-dco' },
  { label: 'Battery',      href: '/dashboard/battery-changes' },
  { label: 'Charger',      href: '/dashboard/charger-changes' },
];

export function TabNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';

  return (
    <nav className="flex border-b border-slate-800 px-4" style={{ background: 'oklch(0.09 0.02 265)' }}>
      {TABS.map(tab => (
        <Link
          key={tab.href}
          href={`${tab.href}${qs}`}
          className={cn(
            'px-4 py-3 text-sm transition-colors border-b-2 -mb-px',
            pathname === tab.href
              ? 'border-blue-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
