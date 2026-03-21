'use client';

import React, { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { MembersTab } from '../../components/team/tabs/MembersTab';
import { RolesTab } from '../../components/team/tabs/RolesTab';
import { DepartmentsTab } from '../../components/team/tabs/DepartmentsTab';
import { TargetsTab } from '../../components/team/tabs/TargetsTab';
import { CredentialsTab } from '../../components/team/tabs/CredentialsTab';
import { AddMemberDrawer } from '../../components/team/AddMemberDrawer';
import { usePermissions } from '../../hooks/usePermissions';

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

  const [showAddRoleDrawer, setShowAddRoleDrawer] = useState(false);

  const getActionButtonLabel = () => {
    switch (activeTab) {
      case 'members':
        return '+ Add Member';
      case 'roles':
        return '+ Add Role';
      case 'departments':
        return '+ Add Department';
      case 'targets':
        return '+ Add Target';
      case 'credentials':
        return null;
      default:
        return null;
    }
  };

  // Use filtered tabs
  const tabs = availableTabs;

  const actionButtonLabel = getActionButtonLabel();

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">
      <div className="p-8 space-y-6">
        {/* Part 1: Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Team</h1>
          </div>
          {mounted && actionButtonLabel && activeTab === 'members' && hasPermission('add_team_member') && (
            <button
              onClick={() => setShowAddMemberDrawer(true)}
              className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 transition-all group"
            >
              <Plus className="size-5 group-hover:rotate-90 transition-transform" />
              {actionButtonLabel}
            </button>
          )}
          {mounted && actionButtonLabel && activeTab === 'roles' && (
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('addRole'));
              }}
              className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 transition-all group"
            >
              <Plus className="size-5 group-hover:rotate-90 transition-transform" />
              {actionButtonLabel}
            </button>
          )}
          {mounted && actionButtonLabel && activeTab === 'departments' && (
            <button
              onClick={() => {
                if ((window as any).openAddDepartmentDrawer) {
                  (window as any).openAddDepartmentDrawer();
                }
              }}
              className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 transition-all group"
            >
              <Plus className="size-5 group-hover:rotate-90 transition-transform" />
              {actionButtonLabel}
            </button>
          )}
          {mounted && actionButtonLabel && activeTab !== 'members' && activeTab !== 'roles' && activeTab !== 'departments' && (
            <button className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 transition-all group">
              <Plus className="size-5 group-hover:rotate-90 transition-transform" />
              {actionButtonLabel}
            </button>
          )}
        </div>

        {/* Part 2: Tab Bar */}
        {tabs.length > 0 && (
          <div className="flex items-center gap-2 bg-slate-100/50 p-1.5 rounded-2xl w-fit border border-slate-200">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm border border-slate-100'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Part 3: Content Area */}
        <div>
          {activeTab === 'members' && <MembersTab />}
          {activeTab === 'roles' && <RolesTab />}
          {activeTab === 'departments' && <DepartmentsTab />}
          {activeTab === 'targets' && <TargetsTab />}
          {activeTab === 'credentials' && <CredentialsTab />}
        </div>
      </div>

      {/* Add Member Drawer */}
      <AddMemberDrawer
        isOpen={showAddMemberDrawer}
        onClose={() => setShowAddMemberDrawer(false)}
        onSuccess={() => {
          setShowAddMemberDrawer(false);
          // MembersTab will refetch on its own
        }}
      />
    </div>
  );
}

export default function TeamPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center text-gray-500">Loading team...</div>}>
      <TeamPageContent />
    </Suspense>
  );
}
