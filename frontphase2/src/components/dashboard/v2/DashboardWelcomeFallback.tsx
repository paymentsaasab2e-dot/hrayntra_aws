'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, LayoutDashboard } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULE_ACCESS_MAP, ROUTE_PERMISSION_GUARDS } from '@/lib/rbac/moduleAccess';

const WORKSPACE_LINKS: Array<{ route: string; label: string; permissions: string[] }> = [
  { route: '/leads', label: 'Leads', permissions: MODULE_ACCESS_MAP.Leads },
  { route: '/client', label: 'Clients', permissions: MODULE_ACCESS_MAP.Clients },
  { route: '/job', label: 'Jobs', permissions: MODULE_ACCESS_MAP.Jobs },
  { route: '/candidate', label: 'Candidates', permissions: MODULE_ACCESS_MAP.Candidates },
  { route: '/interviews', label: 'Interviews', permissions: MODULE_ACCESS_MAP.Interviews },
  { route: '/placement', label: 'Placements', permissions: MODULE_ACCESS_MAP.Placements },
  { route: '/Task&Activites', label: 'Tasks', permissions: MODULE_ACCESS_MAP.Tasks },
  { route: '/request', label: 'Requests', permissions: MODULE_ACCESS_MAP.Request },
  { route: '/team', label: 'Team', permissions: MODULE_ACCESS_MAP.Team },
  { route: '/reports', label: 'Reports', permissions: MODULE_ACCESS_MAP.Reports },
  { route: '/calendar', label: 'Calendar', permissions: MODULE_ACCESS_MAP.Calendar },
  { route: '/inbox', label: 'Inbox', permissions: MODULE_ACCESS_MAP.Inbox },
  { route: '/activity-feed', label: 'Activity log', permissions: ROUTE_PERMISSION_GUARDS['/activity-feed'] },
];

type Props = {
  title?: string;
  description?: string;
};

export function DashboardWelcomeFallback({
  title = 'Your workspace',
  description = 'Open a module below based on what your role can access.',
}: Props) {
  const { hasAnyPermission, isSuperAdmin } = usePermissions();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const links = useMemo(() => {
    if (!mounted) return [];
    if (isSuperAdmin()) return WORKSPACE_LINKS;
    return WORKSPACE_LINKS.filter((item) => hasAnyPermission(item.permissions));
  }, [mounted, hasAnyPermission, isSuperAdmin]);

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-indigo-100/80 bg-gradient-to-br from-indigo-50/50 via-white to-violet-50/40 p-8 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
          <LayoutDashboard size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
      </div>

      {links.length > 0 ? (
        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {links.map((item) => (
            <li key={item.route}>
              <Link
                href={item.route}
                className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition-colors hover:border-indigo-200 hover:bg-indigo-50/40"
              >
                {item.label}
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-slate-500">
          No modules are assigned to your role yet. Contact your administrator for access.
        </p>
      )}
    </div>
  );
}
