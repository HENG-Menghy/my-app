// app/layout.tsx

import "./globals.css";
import { ThemeProvider } from "next-themes";
import type { Metadata } from "next";
import { Geist } from "next/font/google";

export const metadata: Metadata = {
  title: "Meeting Room Management System",
  description: "Streamline your meeting room management with seamless booking, smart scheduling, and advanced secure authentication with rate limiting supports.",
  icons: {
    icon: "/favicon.ico",
  },
};

const geistSans = Geist({
  subsets: ["latin"],
  weight: "500",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.className} antialiased text-sm text-textSecondary bg-colorBg`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
