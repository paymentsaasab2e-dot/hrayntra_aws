import type { Metadata } from "next";
import { Suspense } from "react";
import ActiveSessionManager from "../components/session/ActiveSessionManager";
import { FloatingBotMount } from "../components/FloatingBotMount";
import { GlobalAlertHost } from "../components/GlobalAlertHost";
import { PageTitleSync } from "../components/PageTitleSync";
import { UserPermissionsSync } from "../components/UserPermissionsSync";
import { TrialPlanHost } from "../components/trial/TrialPlanHost";
import { TenantPausedHost } from "../components/tenant/TenantPausedHost";
import { TenantCoinsProvider } from "../components/coins/TenantCoinsContext";
import { TenantBehaviorTrackerHost } from "../components/tenant-behavior/TenantBehaviorTrackerHost";
import "./globals.css";
import "../styles/nexus-dashboard.css";

export const metadata: Metadata = {
  title: "HRYANTRA",
  description: "HRYANTRA - Recruitment Platform",
  icons: {
    icon: '/fs.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <TenantCoinsProvider>
          {children}
          <PageTitleSync />
          <UserPermissionsSync />
          <GlobalAlertHost />
          <TrialPlanHost />
          <TenantPausedHost />
          <ActiveSessionManager />
          <Suspense fallback={null}>
            <TenantBehaviorTrackerHost />
          </Suspense>
          <FloatingBotMount />
        </TenantCoinsProvider>
      </body>
    </html>
  );
}
