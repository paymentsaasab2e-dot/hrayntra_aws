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
  const { hasAnyPermission } = usePermissions();

  const settingsNav = baseSettingsNav.filter((item) => {
    if (item.requiresBillingNav && !showBillingSection) return false;
    if (item.anyPermissions && !hasAnyPermission(item.anyPermissions)) return false;
    return true;
  });
  return (
    <div className="w-72 border-r border-slate-200 h-full bg-white flex flex-col shrink-0">
      <div className="p-6">
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your platform preferences</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <nav className="space-y-1">
          {settingsNav.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive 
                    ? 'bg-[#2b7fff]/5 text-[#2b7fff]' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-[#2b7fff]' : 'text-slate-400'}`} />
                <span className="text-sm font-semibold">{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#2b7fff]" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="p-6 border-t border-slate-100">
        <div className="bg-slate-50 rounded-xl p-4">
          <p className="text-xs font-bold text-slate-400 uppercase mb-2">Support</p>
          <Link
            href="/help-center"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition-colors hover:text-[#2b7fff]"
          >
            <LifeBuoy className="h-4 w-4" />
            Need help?
          </Link>
          <p className="mt-1 text-[11px] text-slate-400">
            Open the Help Center for FAQs and contact options.
          </p>
        </div>
      </div>
    </div>
  );
}
