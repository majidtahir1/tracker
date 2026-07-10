"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell } from "lucide-react";
import { NAV_ITEMS } from "./nav-items";
import { authClient } from "@/lib/auth-client";
import ThemeToggle from "@/components/theme/ThemeToggle";

const RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop sidebar (DESIGN.md §3.2). Hidden below lg. */
export default function Sidebar({ username }: { username: string }) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 hidden lg:flex w-60 flex-col border-r border-border bg-bg-subtle">
      <div className="flex h-16 items-center gap-2.5 px-5 border-b border-border-faint">
        <Dumbbell className="size-5 text-accent" strokeWidth={2} />
        <span className="font-display text-[15px] font-semibold text-text tracking-tight">
          TRACKER
        </span>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors ${RING} ${
                active
                  ? "bg-accent-muted text-accent"
                  : "text-text-3 hover:bg-surface hover:text-text-2"
              }`}
            >
              <Icon className="size-[18px] shrink-0" strokeWidth={2} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-2 p-3 border-t border-border-faint">
        <div className="flex items-center justify-between rounded-sm px-3 py-1.5">
          <ThemeToggle />
        </div>
        <div className="rounded-sm bg-surface px-3 py-2 text-xs text-text-3">
          Block <span className="font-mono text-accent">1</span> · Week{" "}
          <span className="font-mono text-accent">1</span>
        </div>
        <div className="flex items-center justify-between rounded-sm px-3 py-1.5">
          <span className="truncate text-xs font-medium text-text-2">{username}</span>
          <button
            type="button"
            onClick={() => authClient.signOut().then(() => { window.location.href = "/login"; })}
            className={`text-xs text-text-3 hover:text-text-2 ${RING}`}
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
