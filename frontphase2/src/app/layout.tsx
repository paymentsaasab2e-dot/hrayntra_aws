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
import { IdleMount } from "../components/IdleMount";
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <TenantCoinsProvider>
          <TenantImpersonationBanner />
          <RouteErrorBoundary>{children}</RouteErrorBoundary>
          <PageTitleSync />
          <GlobalAlertHost />
          <TrialPlanHost />
          <TenantPausedHost />
          <ActiveSessionManager />
          <IdleMount delayMs={1600}>
            <UserPermissionsSync />
            <TenantIntelligenceHost />
            <WritingAssistHost />
            <FloatingBotMount />
          </IdleMount>
        </TenantCoinsProvider>
      </body>
    </html>
  );
}
