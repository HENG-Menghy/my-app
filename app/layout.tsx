// app/layout.tsx

import "./globals.css";
import { ThemeProvider } from "next-themes";
import type { Metadata } from "next";
import { Geist } from "next/font/google";

export const metadata: Metadata = {
  title: "Meeting Room Management System",
  description: "Streamline your meeting room management with seamless booking, smart scheduling, and advanced secure authentication combine with Upstash Redis rate limiting.",
  icons: {
    icon: "/favicon.ico",
  },
  // description: "A robust platform for room booking, meeting scheduling, and secure authentication. Features hybrid token-session authentication with rate limiting powered by Upstash Redis.",
  // description: "A full-featured system for managing room bookings, meeting scheduling, and secure authentication. Implements hybrid token-session authentication and rate limiting with Upstash Redis.",
};

const geistSans = Geist({
  subsets: ["latin"],
  weight: "400",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.className} antialiased text-sm bg-colorBg text-colorText`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
