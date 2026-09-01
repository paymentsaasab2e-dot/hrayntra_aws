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
  Bell,
  History,
  Percent,
  FileText,
  Eye,
} from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import { MODULE_ACCESS_MAP } from '../lib/rbac/moduleAccess';

/**
 * Profile, Customization, Communication & Integrations, and Subscription & Plan
 * are visible to any signed-in user.
 * The remaining sections expose org-wide configuration and are restricted to
 * users with `manage_settings` (or the listed permissions).
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
  /** When true, only agency-mode tenants see this section. */
  agencyOnly?: boolean;
};

const baseSettingsNav: SettingsNavItem[] = [
  { id: 'profile', label: 'Personal Profile', icon: UserIcon },
  {
    id: 'communication',
    label: 'Communication & Integrations',
    icon: Share2,
  },
  {
    id: 'public-visibility',
    label: 'Public Visibility',
    icon: Eye,
    anyPermissions: [...MODULE_ACCESS_MAP.Jobs, 'manage_settings'],
  },
  {
    id: 'notifications-triggers',
    label: 'Notifications Trigger Points',
    icon: BellRing,
    anyPermissions: ['manage_settings'],
  },
  {
    id: 'alerts-management',
    label: 'Alerts Management',
    icon: Bell,
    anyPermissions: ['manage_settings'],
  },
  {
    id: 'recruitment',
    label: 'Recruitment workflow',
    icon: GitBranch,
    anyPermissions: ['manage_settings'],
  },
  {
    id: 'commission-slabs',
    label: 'Commission slabs',
    icon: Percent,
    anyPermissions: ['manage_settings'],
    agencyOnly: true,
  },
  {
    id: 'billing',
    label: 'Subscription & Plan',
    icon: CreditCard,
  },
  {
    id: 'invoice-template',
    label: 'Invoice template',
    icon: FileText,
    anyPermissions: ['manage_billing_settings', 'access_billing', 'create_invoice', 'manage_settings'],
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
  isAgencyMode?: boolean;
}

export function SettingsSidebar({
  activeSection,
  setActiveSection,
  showBillingSection = true,
  isAgencyMode = true,
}: SettingsSidebarProps) {
  const { hasAnyPermission, isSuperAdmin } = usePermissions();

  const settingsNav = baseSettingsNav.filter((item) => {
    if (item.requiresBillingNav && !showBillingSection) return false;
    if (item.agencyOnly && !isAgencyMode) return false;
    if (item.superAdminOnly && !isSuperAdmin()) return false;
    if (item.anyPermissions && !hasAnyPermission(item.anyPermissions)) return false;
    return true;
  });

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-indigo-100/60 bg-white/90 backdrop-blur-md lg:w-[17.5rem] lg:border-b-0 lg:border-r">
      <div className="border-b border-indigo-100/50 bg-gradient-to-br from-white via-indigo-50/30 to-violet-50/20 px-4 py-4 sm:px-5 sm:py-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-400">
          Workspace
        </p>
        <h1 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm leading-snug text-slate-500">Manage platform preferences</p>
      </div>

      <nav className="overflow-x-auto overflow-y-auto px-3 py-3 lg:flex-1 lg:py-4" aria-label="Settings sections">
        <ul className="flex flex-row gap-1 lg:flex-col">
          {settingsNav.map((item) => {
            const isActive = activeSection === item.id;
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group flex w-full min-w-[12rem] shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-left transition-all lg:min-w-0 lg:whitespace-normal ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30'
                      : 'text-slate-600 hover:bg-indigo-50/60 hover:text-indigo-900'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      isActive
                        ? 'bg-white/20 text-white ring-1 ring-white/25'
                        : 'bg-indigo-50 text-indigo-500 group-hover:bg-indigo-100 group-hover:text-indigo-700'
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium leading-snug">
                    {item.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="hidden border-t border-indigo-100/50 p-4 lg:block">
        <div className="rounded-2xl border border-indigo-100/70 bg-gradient-to-br from-white via-indigo-50/40 to-violet-50/30 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-400">
            Support
          </p>
          <Link
            href="/help-center"
            className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-900 transition-colors hover:text-indigo-700"
          >
            <LifeBuoy className="h-4 w-4 shrink-0 text-indigo-600" />
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
