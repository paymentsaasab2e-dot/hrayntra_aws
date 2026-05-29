'use client';

import React from 'react';
import Link from 'next/link';
import {
  Share2,
  CreditCard,
  Lock,
  Sliders,
  User as UserIcon,
  LifeBuoy,
  GitBranch,
  BellRing,
  History,
} from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';

/**
 * Profile + Customization are always visible to any signed-in user (basic
 * personal preferences). The remaining sections expose org-wide configuration
 * and are restricted to users with `manage_settings`. Billing has its own
 * `access_billing` gate plus the org-level billing toggle.
 */
type SettingsNavItem = {
  id: string;
  label: string;
  icon: typeof UserIcon;
  /** When set, only users with one of these permissions see the section. */
  anyPermissions?: string[];
  /** When true, also requires the org-level billing toggle to be on. */
  requiresBillingNav?: boolean;
  /** When true, only Super Admin users see this section. */
  superAdminOnly?: boolean;
};

const baseSettingsNav: SettingsNavItem[] = [
  { id: 'profile', label: 'Personal Profile', icon: UserIcon },
  {
    id: 'communication',
    label: 'Communication & Integrations',
    icon: Share2,
    anyPermissions: ['manage_settings', 'access_integrations'],
  },
  {
    id: 'notifications-triggers',
    label: 'Notifications Trigger Points',
    icon: BellRing,
    anyPermissions: ['manage_settings'],
  },
  {
    id: 'recruitment',
    label: 'Recruitment workflow',
    icon: GitBranch,
    anyPermissions: ['manage_settings'],
  },
  {
    id: 'billing',
    label: 'Billing & Commission',
    icon: CreditCard,
    anyPermissions: ['access_billing', 'manage_settings'],
    requiresBillingNav: true,
  },
  {
    id: 'security',
    label: 'Data & Security',
    icon: Lock,
    anyPermissions: ['manage_settings'],
  },
  {
    id: 'activity-log',
    label: 'Activity Log',
    icon: History,
    superAdminOnly: true,
  },
  { id: 'customization', label: 'Customization', icon: Sliders },
];

interface SettingsSidebarProps {
  activeSection: string;
  setActiveSection: (id: string) => void;
  showBillingSection?: boolean;
}

export function SettingsSidebar({
  activeSection,
  setActiveSection,
  showBillingSection = true,
}: SettingsSidebarProps) {
  const { hasAnyPermission, isSuperAdmin } = usePermissions();

  const settingsNav = baseSettingsNav.filter((item) => {
    if (item.requiresBillingNav && !showBillingSection) return false;
    if (item.superAdminOnly && !isSuperAdmin()) return false;
    if (item.anyPermissions && !hasAnyPermission(item.anyPermissions)) return false;
    return true;
  });

  return (
    <aside className="flex w-[17.5rem] shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-5">
        <h1 className="text-lg font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm leading-snug text-slate-500">Manage your platform preferences</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Settings sections">
        <ul className="flex flex-col gap-1">
          {settingsNav.map((item) => {
            const isActive = activeSection === item.id;
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                  </span>
                  <span
                    className={`min-w-0 flex-1 text-sm font-medium leading-snug ${
                      isActive ? 'text-blue-900' : ''
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-slate-100 p-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Support</p>
          <Link
            href="/help-center"
            className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700"
          >
            <LifeBuoy className="h-4 w-4 shrink-0" />
            Need help?
          </Link>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            Open the Help Center for FAQs and contact options.
          </p>
        </div>
      </div>
    </aside>
  );
}
