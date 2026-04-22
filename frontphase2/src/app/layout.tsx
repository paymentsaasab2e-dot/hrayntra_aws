import type { Metadata } from "next";
import { FloatingBotMount } from "../components/FloatingBotMount";
import { GlobalAlertHost } from "../components/GlobalAlertHost";
import { PageTitleSync } from "../components/PageTitleSync";
import "./globals.css";

export const metadata: Metadata = {
  title: "HRYANTRA",
  description: "HRYANTRA - Recruitment Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <PageTitleSync />
        <GlobalAlertHost />
        <FloatingBotMount />
      </body>
    </html>
  );
}
