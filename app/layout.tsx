import type { Metadata } from "next";
import "./globals.css";
import { grotesk, inter, mono } from "./fonts";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";

export const metadata: Metadata = {
  title: { default: "Tracker", template: "%s · Tracker" },
  description: "Hypertrophy training tracker — Program v1.0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable} ${mono.variable}`}>
      <body className="min-h-dvh font-sans">
        <Sidebar />
        <main className="lg:pl-60">
          <div className="mx-auto max-w-7xl px-4 py-6 pb-24 lg:px-8 lg:py-8 lg:pb-8">
            {children}
          </div>
        </main>
        <MobileNav />
      </body>
    </html>
  );
}
