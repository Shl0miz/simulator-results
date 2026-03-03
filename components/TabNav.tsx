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
    <nav className="flex border-b px-4" style={{ background: '#04040B', borderColor: '#44474F' }}>
      {TABS.map(tab => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={`${tab.href}${qs}`}
            className={cn(
              'px-4 py-3 transition-colors border-b-2 -mb-px tracking-widest uppercase',
              active
                ? 'border-[#FAFA2D] text-[#FAFA2D]'
                : 'border-transparent text-[#686B6D] hover:text-[#EDF0F3]'
            )}
            style={{ fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif', fontSize: '0.65rem', letterSpacing: '0.1em' }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
