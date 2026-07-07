'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { SettingsSidebar } from '../../components/SettingsSidebar';
import { CommunicationSettings } from '../../components/settings/CommunicationSettings';
import { NotificationTriggerSettings } from '../../components/settings/NotificationTriggerSettings';
import { AlertsManagementSettings } from '../../components/settings/AlertsManagementSettings';
import { RecruitmentWorkflowSettings } from '../../components/settings/RecruitmentWorkflowSettings';
import { BillingSettings } from '../../components/BillingSettings';
import { SecuritySettings } from '../../components/SecuritySettings';
import { CustomizationSettings } from '../../components/CustomizationSettings';
import { ProfileSettings } from '../../components/ProfileSettings';
import { Toaster } from 'sonner';
import { isOrgBillingNavEnabled, ORG_RECRUITMENT_CACHE_EVENT } from '../../lib/api';
import { usePermissions } from '../../hooks/usePermissions';
import { ActivityLogSettings } from '../../components/settings/ActivityLogSettings';

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('profile');
  const [showBillingSection, setShowBillingSection] = useState(true);
  const { hasAnyPermission, isSuperAdmin } = usePermissions();

  // Profile + Customization are always available; everything else needs at
  // least one of the listed permissions. This keeps non-admin users from
  // seeing confidential org configuration even via deep-link.
  const canSeeSection = useMemo(
    () => (section: string): boolean => {
      switch (section) {
        case 'profile':
        case 'customization':
          return true;
        case 'communication':
          return hasAnyPermission(['manage_settings', 'access_integrations']);
        case 'notifications-triggers':
        case 'alerts-management':
          return hasAnyPermission(['manage_settings']);
        case 'recruitment':
        case 'security':
          return hasAnyPermission(['manage_settings']);
        case 'billing':
          return true;
        case 'activity-log':
          return isSuperAdmin();
        default:
          return true;
      }
    },
    [hasAnyPermission, showBillingSection]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const refreshBilling = () => setShowBillingSection(isOrgBillingNavEnabled());
    refreshBilling();
    window.addEventListener(ORG_RECRUITMENT_CACHE_EVENT, refreshBilling);
    return () => window.removeEventListener(ORG_RECRUITMENT_CACHE_EVENT, refreshBilling);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const section = new URLSearchParams(window.location.search).get('section');
    const allowedSections = [
      'profile',
      'communication',
      'notifications-triggers',
      'alerts-management',
      'recruitment',
      'billing',
      'security',
      'customization',
      'activity-log',
    ];
    if (section && allowedSections.includes(section)) {
      setActiveSection(section);
    }
  }, []);

  useEffect(() => {
    if (!canSeeSection(activeSection)) {
      setActiveSection('profile');
    }
  }, [activeSection, canSeeSection]);

  const renderContent = () => {
    if (!canSeeSection(activeSection)) {
      return <ProfileSettings />;
    }
    switch (activeSection) {
      case 'profile':
        return <ProfileSettings />;
      case 'communication':
        return <CommunicationSettings />;
      case 'notifications-triggers':
        return <NotificationTriggerSettings />;
      case 'alerts-management':
        return <AlertsManagementSettings />;
      case 'recruitment':
        return <RecruitmentWorkflowSettings />;
      case 'billing':
        return <BillingSettings />;
      case 'security':
        return <SecuritySettings />;
      case 'customization':
        return <CustomizationSettings />;
      case 'activity-log':
        return <ActivityLogSettings />;
      default:
        return <ProfileSettings />;
    }
  };

  const sectionTitleMap: Record<string, string> = {
    profile: 'Personal Profile',
    communication: 'Communication & Integrations',
    'notifications-triggers': 'Notifications Trigger Points',
    'alerts-management': 'Alerts Management',
    recruitment: 'Recruitment workflow',
    billing: 'Subscription & Plan',
    security: 'Data & Security',
    'activity-log': 'Activity Log',
    customization: 'Customization',
  };

  const sectionTitle = sectionTitleMap[activeSection] || 'Settings';

  return (
    <>
      <Toaster position="top-right" richColors />

      <div className="flex min-h-[calc(100dvh-3.5rem)] bg-slate-50">
        <SettingsSidebar
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          showBillingSection={showBillingSection}
        />

        <div className="min-w-0 flex-1 overflow-y-auto">
          <div
            className={`mx-auto px-6 py-8 lg:px-10 ${
              activeSection === 'activity-log' || activeSection === 'alerts-management'
                ? 'max-w-[90rem]'
                : 'max-w-5xl'
            }`}
          >
            <header className="mb-8 border-b border-slate-200 pb-6">
              <nav className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400">
                <span>Dashboard</span>
                <span aria-hidden>/</span>
                <span>Settings</span>
                <span aria-hidden>/</span>
                <span className="text-slate-900">{sectionTitle}</span>
              </nav>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">{sectionTitle}</h2>
              {activeSection !== 'alerts-management' ? (
                <p className="mt-1 text-sm text-slate-500">
                  Configure {sectionTitle.toLowerCase()} for your workspace.
                </p>
              ) : null}
            </header>

            {renderContent()}

            <footer className="mt-12 flex flex-col gap-3 border-t border-slate-200 py-8 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <p>© 2026 HRYANTRA Recruitment Agency Platform. All rights reserved.</p>
              <div className="flex flex-wrap gap-4">
                <button type="button" className="hover:text-slate-600">
                  Privacy Policy
                </button>
                <button type="button" className="hover:text-slate-600">
                  Terms of Service
                </button>
                <button type="button" className="hover:text-slate-600">
                  API Documentation
                </button>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </>
  );
}
