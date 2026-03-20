'use client';

import React, { useState } from 'react';
import { SettingsSidebar } from '../../components/SettingsSidebar';
import { OrganizationSettings } from '../../components/OrganizationSettings';
import { WorkflowSettings } from '../../components/WorkflowSettings';
import { RolesPermissionsSettings } from '../../components/RolesPermissionsSettings';
import { CommunicationSettings } from '../../components/CommunicationSettings';
import { BillingSettings } from '../../components/BillingSettings';
import { SecuritySettings } from '../../components/SecuritySettings';
import { CustomizationSettings } from '../../components/CustomizationSettings';
import { Toaster, toast } from 'sonner';

const companyLogo = "https://images.unsplash.com/photo-1709817552870-f96756fb8c9f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBjb21wYW55JTIwbG9nbyUyMG1pbmltYWx8ZW58MXx8fHwxNzcwNzUzNDIxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('organization');

  const renderContent = () => {
    switch (activeSection) {
      case 'organization':
        return <OrganizationSettings logo={companyLogo} />;
      case 'workflow':
        return <WorkflowSettings />;
      case 'roles':
        return <RolesPermissionsSettings />;
      case 'communication':
        return <CommunicationSettings />;
      case 'billing':
        return <BillingSettings />;
      case 'security':
        return <SecuritySettings />;
      case 'customization':
        return <CustomizationSettings />;
      default:
        return <OrganizationSettings logo={companyLogo} />;
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
              <p>© 2026 SAASA Recruitment Agency Platform. All rights reserved.</p>
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
