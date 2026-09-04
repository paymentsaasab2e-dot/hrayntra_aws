import type { Metadata } from "next";
import ActiveSessionManager from "../components/session/ActiveSessionManager";
import { TenantImpersonationBanner } from "../components/team/TenantImpersonationBanner";
import { FloatingBotMount } from "../components/FloatingBotMount";
import { GlobalAlertHost } from "../components/GlobalAlertHost";
import { PageTitleSync } from "../components/PageTitleSync";
import { UserPermissionsSync } from "../components/UserPermissionsSync";
import { TrialPlanHost } from "../components/trial/TrialPlanHost";
import { TenantPausedHost } from "../components/tenant/TenantPausedHost";
import { TenantCoinsProvider } from "../components/coins/TenantCoinsContext";
import { TenantIntelligenceHost } from "../components/phase2-intelligence/TenantIntelligenceHost";
import { WritingAssistHost } from "../components/common/WritingAssistHost";
import { RouteErrorBoundary } from "../components/PageErrorBoundary";
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
          <TenantImpersonationBanner />
          <RouteErrorBoundary>{children}</RouteErrorBoundary>
          <PageTitleSync />
          <UserPermissionsSync />
          <GlobalAlertHost />
          <TrialPlanHost />
          <TenantPausedHost />
          <ActiveSessionManager />
          <TenantIntelligenceHost />
          <WritingAssistHost />
          <FloatingBotMount />
        </TenantCoinsProvider>
      </body>
    </html>
  );
}
