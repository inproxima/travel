import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import { Header } from "@/components/shell/header";
import { Providers } from "@/components/shell/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Waypoint · Travel Planner",
  description: "Flights with cash or points, hotels, and an AI stay planner.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh font-sans">
        <Providers>
          <Header />
          <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">{children}</main>
          <Toaster richColors position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}
