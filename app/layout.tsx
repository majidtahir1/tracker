import type { Metadata } from "next";
import "./globals.css";
import { grotesk, inter, mono } from "./fonts";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";
import { getSessionUser } from "@/lib/session";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import ThemeProvider from "@/components/theme/ThemeProvider";
import PushRegistrar from "@/components/push/PushRegistrar";

export const metadata: Metadata = {
  title: { default: "Tracker", template: "%s · Tracker" },
  description: "Hypertrophy training tracker — Program v1.0",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();
  return (
    <html
      lang="en"
      className={`${inter.variable} ${grotesk.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh font-sans">
        <ThemeProvider>
          {user ? (
            <>
              <PushRegistrar />
              <Sidebar username={user.displayUsername ?? user.username ?? user.name} />
              <main className="lg:pl-60">
                <div className="mx-auto max-w-[110rem] px-4 py-6 pb-24 lg:px-8 lg:py-8 lg:pb-8">
                  {children}
                </div>
              </main>
              <MobileNav />
            </>
          ) : (
            children
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}
