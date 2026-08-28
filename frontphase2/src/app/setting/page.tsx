'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { SettingsSidebar } from '../../components/SettingsSidebar';
import { CommunicationSettings } from '../../components/settings/CommunicationSettings';
import { NotificationTriggerSettings } from '../../components/settings/NotificationTriggerSettings';
import { AlertsManagementSettings } from '../../components/settings/AlertsManagementSettings';
import { RecruitmentWorkflowSettings } from '../../components/settings/RecruitmentWorkflowSettings';
import { BillingSettings } from '../../components/BillingSettings';
import { InvoiceTemplateSettings } from '../../components/settings/InvoiceTemplateSettings';
import { SecuritySettings } from '../../components/SecuritySettings';
import { CustomizationSettings } from '../../components/CustomizationSettings';
import { ProfileSettings } from '../../components/ProfileSettings';
import { Toaster } from 'sonner';
import { isOrgBillingNavEnabled, ORG_RECRUITMENT_CACHE_EVENT, getCachedOrgRecruitmentMode } from '../../lib/api';
import { CommissionSlabSettings } from '../../components/settings/CommissionSlabSettings';
import { usePermissions } from '../../hooks/usePermissions';
import { ActivityLogSettings } from '../../components/settings/ActivityLogSettings';
import { confirmDiscardUnsavedChanges } from '../../hooks/useDrawerUnsavedGuard';
import { useUnsavedPageGuard } from '../../hooks/useUnsavedPageGuard';

const UNSAVED_SETTINGS_MESSAGE =
  'You have unsaved changes on this page. Do you want to discard them and leave?';

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('profile');
  const [showBillingSection, setShowBillingSection] = useState(true);
  const [isAgencyMode, setIsAgencyMode] = useState(true);
  const [profileDirty, setProfileDirty] = useState(false);
  const { hasAnyPermission, isSuperAdmin } = usePermissions();

  // Popup when leaving Settings via main sidenav / other in-app links without saving.
  useUnsavedPageGuard({
    isDirty: activeSection === 'profile' && profileDirty,
    message: UNSAVED_SETTINGS_MESSAGE,
    onDiscard: () => setProfileDirty(false),
  });

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
        case 'commission-slabs':
          return isAgencyMode && hasAnyPermission(['manage_settings']);
        case 'billing':
          return true;
        case 'invoice-template':
          return (
            showBillingSection &&
            hasAnyPermission([
              'manage_billing_settings',
              'access_billing',
              'create_invoice',
              'manage_settings',
            ])
          );
        case 'activity-log':
          return isSuperAdmin();
        default:
          return true;
      }
    },
    [hasAnyPermission, isSuperAdmin, isAgencyMode, showBillingSection],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const refreshBilling = () => {
      setShowBillingSection(isOrgBillingNavEnabled());
      setIsAgencyMode(getCachedOrgRecruitmentMode() !== 'standalone');
    };
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
      'commission-slabs',
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

  const requestSectionChange = useCallback(
    async (nextSection: string) => {
      if (nextSection === activeSection) return;
      if (activeSection === 'profile' && profileDirty) {
        const confirmed = await confirmDiscardUnsavedChanges(UNSAVED_SETTINGS_MESSAGE);
        if (!confirmed) return;
        setProfileDirty(false);
      }
      setActiveSection(nextSection);
    },
    [activeSection, profileDirty],
  );

  const renderContent = () => {
    if (!canSeeSection(activeSection)) {
      return <ProfileSettings onDirtyChange={setProfileDirty} />;
    }
    switch (activeSection) {
      case 'profile':
        return <ProfileSettings onDirtyChange={setProfileDirty} />;
      case 'communication':
        return <CommunicationSettings />;
      case 'notifications-triggers':
        return <NotificationTriggerSettings />;
      case 'alerts-management':
        return <AlertsManagementSettings />;
      case 'recruitment':
        return <RecruitmentWorkflowSettings />;
      case 'commission-slabs':
        return <CommissionSlabSettings />;
      case 'billing':
        return <BillingSettings />;
      case 'invoice-template':
        return <InvoiceTemplateSettings />;
      case 'security':
        return <SecuritySettings />;
      case 'customization':
        return <CustomizationSettings />;
      case 'activity-log':
        return <ActivityLogSettings />;
      default:
        return <ProfileSettings onDirtyChange={setProfileDirty} />;
    }
  };

  const sectionTitleMap: Record<string, string> = {
    profile: 'Personal Profile',
    communication: 'Communication & Integrations',
    'notifications-triggers': 'Notifications Trigger Points',
    'alerts-management': 'Alerts Management',
    recruitment: 'Recruitment workflow',
    'commission-slabs': 'Commission slabs',
    billing: 'Subscription & Plan',
    'invoice-template': 'Invoice template',
    security: 'Data & Security',
    'activity-log': 'Activity Log',
    customization: 'Customization',
  };

  const sectionTitle = sectionTitleMap[activeSection] || 'Settings';

  return (
    <>
      <Toaster position="top-right" richColors />

      <div className="flex min-h-[calc(100dvh-3.5rem)] bg-gradient-to-br from-slate-50 via-indigo-50/20 to-violet-50/15">
        <SettingsSidebar
          activeSection={activeSection}
          setActiveSection={(id) => {
            void requestSectionChange(id);
          }}
          showBillingSection={showBillingSection}
          isAgencyMode={isAgencyMode}
        />

        <div className="min-w-0 flex-1 overflow-y-auto">
          {/* Full-bleed: settings panels use the whole area next to the sidebar
              instead of being capped to a narrow centred column. */}
          <div className="w-full px-6 py-8 lg:px-10">
            <header className="mb-8 border-b border-slate-200 pb-6">
              <nav className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400">
                <span>Dashboard</span>
                <span aria-hidden>/</span>
                <span>Settings</span>
                <span aria-hidden>/</span>
                <span className="font-semibold text-indigo-700">{sectionTitle}</span>
              </nav>
              <div className="rounded-xl border border-indigo-100/60 bg-white/80 px-5 py-4 shadow-[0_12px_40px_-18px_rgba(59,130,246,0.16)] backdrop-blur-sm sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
                    <SettingsIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                      {sectionTitle}
                    </h2>
                    {activeSection !== 'alerts-management' ? (
                      <p className="mt-0.5 text-sm text-slate-500">
                        Configure {sectionTitle.toLowerCase()} for your workspace.
                      </p>
                    ) : (
                      <p className="mt-0.5 text-sm text-slate-500">
                        Choose which alerts reach email and the portal for your team.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </header>

            {renderContent()}

            <footer
              className={`flex flex-col gap-3 border-t border-slate-200 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between ${
                activeSection === 'invoice-template' ? 'mt-4 py-4' : 'mt-12 py-8'
              }`}
            >
              <p>© 2026 HRYANTRA Recruitment Agency Platform. All rights reserved.</p>
              <div className="flex flex-wrap gap-4">
                <button type="button" className="hover:text-indigo-600">
                  Privacy Policy
                </button>
                <button type="button" className="hover:text-indigo-600">
                  Terms of Service
                </button>
                <button type="button" className="hover:text-indigo-600">
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
