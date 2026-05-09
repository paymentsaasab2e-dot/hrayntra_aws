'use client';

import { Sidenav } from '../../components/Sidenav';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const avatarUrl = "https://images.unsplash.com/photo-1701463387028-3947648f1337?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBidXNpbmVzcyUyMHBlcnNvbiUyMHBvcnRyYWl0JTIwYXZhdGFyfGVufDF8fHx8MTc3MDE4MTAyMHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";

  // Profile + basic Customization tabs are accessible to every authenticated
  // user. Confidential subsections (Recruitment workflow, Communication,
  // Billing, Security) are gated inside SettingsSidebar / SettingsPage by
  // permission so users without `manage_settings` still get the page but only
  // see their personal preferences.
  return (
    <div className="min-h-screen bg-slate-50 font-['Arimo',sans-serif]">
      <Sidenav
        avatarUrl={avatarUrl}
        userProfile={{
          name: 'Ulli Thumke',
          role: 'UI Designer',
          avatarUrl: avatarUrl
        }}
      >
        {children}
      </Sidenav>
    </div>
  );
}
