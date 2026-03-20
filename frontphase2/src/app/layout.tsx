import type { Metadata } from "next";
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
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
