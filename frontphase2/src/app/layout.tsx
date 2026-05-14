import type { Metadata } from "next";
import { FloatingBotMount } from "../components/FloatingBotMount";
import { GlobalAlertHost } from "../components/GlobalAlertHost";
import { PageTitleSync } from "../components/PageTitleSync";
import { UserPermissionsSync } from "../components/UserPermissionsSync";
import "./globals.css";

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
        {children}
        <PageTitleSync />
        <UserPermissionsSync />
        <GlobalAlertHost />
        <FloatingBotMount />
      </body>
    </html>
  );
}
