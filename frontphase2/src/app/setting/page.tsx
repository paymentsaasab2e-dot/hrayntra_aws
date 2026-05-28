'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { SettingsSidebar } from '../../components/SettingsSidebar';
import { CommunicationSettings } from '../../components/settings/CommunicationSettings';
import { NotificationTriggerSettings } from '../../components/settings/NotificationTriggerSettings';
import { RecruitmentWorkflowSettings } from '../../components/settings/RecruitmentWorkflowSettings';
import { BillingSettings } from '../../components/BillingSettings';
import { SecuritySettings } from '../../components/SecuritySettings';
import { CustomizationSettings } from '../../components/CustomizationSettings';
import { ProfileSettings } from '../../components/ProfileSettings';
import { Toaster } from 'sonner';
import { isOrgBillingNavEnabled, ORG_RECRUITMENT_CACHE_EVENT } from '../../lib/api';
import { usePermissions } from '../../hooks/usePermissions';

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('profile');
  const [showBillingSection, setShowBillingSection] = useState(true);
  const { hasAnyPermission } = usePermissions();

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
          return hasAnyPermission(['manage_settings']);
        case 'recruitment':
        case 'security':
          return hasAnyPermission(['manage_settings']);
        case 'billing':
          return showBillingSection && hasAnyPermission(['access_billing', 'manage_settings']);
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
      'recruitment',
      'billing',
      'security',
      'customization',
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
      case 'recruitment':
        return <RecruitmentWorkflowSettings />;
      case 'billing':
        return <BillingSettings />;
      case 'security':
        return <SecuritySettings />;
      case 'customization':
        return <CustomizationSettings />;
      default:
        return <ProfileSettings />;
    }
  };

  return (
    <>
      <Toaster position="top-right" richColors />
      
      {/* Main Content Area */}
      <div className="flex h-full overflow-hidden">
        {/* Settings Secondary Sidebar */}
        <SettingsSidebar
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          showBillingSection={showBillingSection}
        />

        {/* Dynamic Settings Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          <div className="max-w-5xl mx-auto p-8 pt-10">
            <div className="mb-8">
              <nav className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-2">
                <span>Dashboard</span>
                <span>/</span>
                <span className="text-slate-900">Settings</span>
              </nav>
              <h2 className="text-2xl font-bold text-slate-900 capitalize">
                {activeSection.replace('-', ' ')} Settings
              </h2>
            </div>

            {renderContent()}

            <footer className="mt-12 py-8 border-t border-slate-200 flex justify-between items-center text-xs text-slate-400">
              <p>© 2026 HRYANTRA Recruitment Agency Platform. All rights reserved.</p>
              <div className="flex gap-4">
                <button className="hover:text-slate-600">Privacy Policy</button>
                <button className="hover:text-slate-600">Terms of Service</button>
                <button className="hover:text-slate-600">API Documentation</button>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </>
  );
}
