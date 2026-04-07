import type { Metadata } from "next";
import { FloatingBotMount } from "../components/FloatingBotMount";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sidebar Component",
  description: "Sidebar component with Tailwind CSS and Next.js",
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
