import type { Metadata } from "next";
import { FloatingBotMount } from "../components/FloatingBotMount";
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
        <FloatingBotMount />
      </body>
    </html>
  );
}
