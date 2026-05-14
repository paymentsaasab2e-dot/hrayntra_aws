'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, Users, Download, RefreshCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { Toaster } from 'sonner';
import { usePermissions } from '../../hooks/usePermissions';
import { MembersTab, type TeamMembersHeaderExtras } from '../../components/team/tabs/MembersTab';
import { RolesTab } from '../../components/team/tabs/RolesTab';
import { DepartmentsTab } from '../../components/team/tabs/DepartmentsTab';
import { TargetsTab } from '../../components/team/tabs/TargetsTab';
import { CredentialsTab } from '../../components/team/tabs/CredentialsTab';
import { AddMemberDrawer } from '../../components/team/AddMemberDrawer';

export const dynamic = 'force-dynamic';

type TabType = 'members' | 'roles' | 'departments' | 'targets' | 'credentials';

function TeamPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const [mounted, setMounted] = useState(false);
  const tabFromUrl = searchParams?.get('tab') as TabType | null;
  const validTabs: TabType[] = ['members', 'roles', 'departments', 'targets', 'credentials'];
  const [activeTab, setActiveTab] = useState<TabType>(
    tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'members'
  );
  const [showAddMemberDrawer, setShowAddMemberDrawer] = useState(false);
  const [membersHeaderExtras, setMembersHeaderExtras] = useState<TeamMembersHeaderExtras | null>(null);

  useEffect(() => {
    if (activeTab !== 'members') {
      setMembersHeaderExtras(null);
    }
  }, [activeTab]);

  // Ensure client-side only rendering to prevent hydration errors
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Filter tabs based on permissions - Super Admin sees all tabs
  // Only compute after mounting to prevent hydration mismatch
  const availableTabs = useMemo(() => {
    if (!mounted) return [{ id: 'members' as TabType, label: 'Members' }]; // Default during SSR
    
    const isSuperAdminUser = isSuperAdmin();
    return isSuperAdminUser
      ? [
          { id: 'members' as TabType, label: 'Members' },
          { id: 'roles' as TabType, label: 'Roles' },
          { id: 'departments' as TabType, label: 'Departments' },
          { id: 'targets' as TabType, label: 'Targets & KPI' },
          { id: 'credentials' as TabType, label: 'Credentials' },
        ]
      : [
          { id: 'members' as TabType, label: 'Members' },
          ...(hasPermission('assign_roles') ? [{ id: 'roles' as TabType, label: 'Roles' }] : []),
          ...(hasPermission('add_team_member') ? [{ id: 'departments' as TabType, label: 'Departments' }] : []),
          ...(hasPermission('manage_targets') ? [{ id: 'targets' as TabType, label: 'Targets & KPI' }] : []),
        ];
  }, [mounted, hasPermission, isSuperAdmin]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    router.push(`/team?tab=${tab}`, { scroll: false });
  };

  const getActionButtonLabel = () => {
    switch (activeTab) {
      case 'members':
        return 'Add Member';
      case 'roles':
        return 'Add Role';
      case 'departments':
        return 'Add Department';
      case 'targets':
        return 'Add Target';
      case 'credentials':
        return null;
      default:
        return null;
    }
  };

  // Use filtered tabs
  const tabs = availableTabs;

  const actionButtonLabel = getActionButtonLabel();

  const primaryHeaderAction = useMemo(() => {
    if (!mounted || !actionButtonLabel) return null;
    const btnClass =
      'flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 active:scale-[0.98]';
    if (activeTab === 'members' && hasPermission('add_team_member')) {
      return (
        <button type="button" onClick={() => setShowAddMemberDrawer(true)} className={btnClass}>
          <Plus size={16} className="text-white" strokeWidth={2.5} />
          <span>{actionButtonLabel}</span>
        </button>
      );
    }
    if (activeTab === 'roles') {
      return (
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('addRole'))}
          className={btnClass}
        >
          <Plus size={16} className="text-white" strokeWidth={2.5} />
          <span>{actionButtonLabel}</span>
        </button>
      );
    }
    if (activeTab === 'departments') {
      return (
        <button
          type="button"
          onClick={() => {
            if ((window as unknown as { openAddDepartmentDrawer?: () => void }).openAddDepartmentDrawer) {
              (window as unknown as { openAddDepartmentDrawer: () => void }).openAddDepartmentDrawer();
            }
          }}
          className={btnClass}
        >
          <Plus size={16} className="text-white" strokeWidth={2.5} />
          <span>{actionButtonLabel}</span>
        </button>
      );
    }
    if (activeTab === 'targets') {
      return (
        <button type="button" className={btnClass}>
          <Plus size={16} className="text-white" strokeWidth={2.5} />
          <span>{actionButtonLabel}</span>
        </button>
      );
    }
    return null;
  }, [mounted, actionButtonLabel, activeTab, hasPermission]);

  return (
    <>
      <Toaster position="top-right" richColors style={{ top: '5rem' }} />
      <div className="w-full min-h-screen overflow-hidden text-slate-900">
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="flex min-h-[4.5rem] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-indigo-100/50 bg-white/80 px-4 py-3 shadow-[inset_0_-1px_0_0_rgba(99,102,241,0.08)] backdrop-blur-md sm:px-6">
            <div className="flex items-start gap-2.5 sm:gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
                <Users className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-tight tracking-tight text-slate-900 sm:text-[1.35rem]">Team</h1>
                <p className="mt-0.5 max-w-xl text-xs text-slate-500">
                  Members, roles, departments, and access — aligned with your recruitment workspace.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
              {activeTab === 'members' && membersHeaderExtras ? (
                <>
                  <span className="whitespace-nowrap text-[11px] font-medium text-slate-500 sm:text-xs">
                    Showing: <span className="font-semibold text-slate-800">{membersHeaderExtras.pageCount}</span> /{' '}
                    <span className="font-semibold text-slate-800">{membersHeaderExtras.total}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => membersHeaderExtras.onRefresh()}
                    disabled={membersHeaderExtras.isLoading}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-200/80 bg-white text-indigo-700 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.2)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98] disabled:opacity-50"
                    title="Refresh list"
                  >
                    <RefreshCcw
                      size={16}
                      strokeWidth={2.25}
                      className={membersHeaderExtras.isLoading ? 'animate-spin' : ''}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => membersHeaderExtras.onExport()}
                    className="flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98]"
                    title="Export visible team members to CSV"
                  >
                    <Download size={16} className="text-indigo-600" strokeWidth={2.25} />
                    <span>Export</span>
                  </button>
                </>
              ) : null}
              {primaryHeaderAction}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
            <div className="mx-auto max-w-[1600px]">
              {tabs.length > 0 ? (
                <div className="no-scrollbar mb-4 flex overflow-x-auto border-b border-indigo-100/50 bg-white/60 px-1 sm:px-2">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleTabChange(tab.id)}
                      className={`relative whitespace-nowrap px-3 py-3 text-xs font-semibold transition-all sm:px-4 sm:text-sm ${
                        activeTab === tab.id ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {tab.label}
                      {activeTab === tab.id ? (
                        <motion.div
                          layoutId="teamPageActiveTab"
                          className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-indigo-600 sm:left-3 sm:right-3"
                        />
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}

              {activeTab === 'members' && <MembersTab onHeaderExtrasChange={setMembersHeaderExtras} />}
              {activeTab === 'roles' && <RolesTab />}
              {activeTab === 'departments' && <DepartmentsTab />}
              {activeTab === 'targets' && <TargetsTab />}
              {activeTab === 'credentials' && <CredentialsTab />}
            </div>
          </div>
        </main>
      </div>

      <AddMemberDrawer
        isOpen={showAddMemberDrawer}
        onClose={() => setShowAddMemberDrawer(false)}
        onSuccess={(member) => {
          setShowAddMemberDrawer(false);
          if (member) {
            window.dispatchEvent(new CustomEvent('team:member-created', { detail: member }));
          }
        }}
      />
    </>
  );
}

export default function TeamPage() {
  return <TeamPageContent />;
}
