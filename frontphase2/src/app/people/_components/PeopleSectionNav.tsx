'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SECTIONS = [
  { href: '/people', label: 'Employees' },
  { href: '/people/onboarding', label: 'Onboarding' },
  { href: '/people/attendance', label: 'Attendance' },
  { href: '/people/leave', label: 'Leave' },
  { href: '/people/payroll', label: 'Payroll' },
  { href: '/people/inbox', label: 'Inbox' },
  { href: '/people/organisation', label: 'Organisation' },
  { href: '/people/holidays', label: 'Holidays' },
  { href: '/people/assets', label: 'Assets' },
  { href: '/people/letters', label: 'Letters' },
  { href: '/people/exit', label: 'Exit' },
  { href: '/people/policies', label: 'Policies' },
  { href: '/people/reports', label: 'Reports' },
  { href: '/people/settings', label: 'Settings' },
];

export function PeopleSectionNav() {
  const pathname = usePathname() || '';
  return (
    <nav aria-label="People sections" className="mb-3 flex gap-1 overflow-x-auto pb-1">
      {SECTIONS.map((section) => {
        const active =
          section.href === '/people' ? pathname === '/people' : pathname === section.href || pathname.startsWith(`${section.href}/`);
        return (
          <Link
            key={section.href}
            href={section.href}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
              active ? 'bg-[#101b35] text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900'
            }`}
            aria-current={active ? 'page' : undefined}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
