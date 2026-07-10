"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis, LogOut, X } from "lucide-react";
import { MOBILE_NAV_HREFS, NAV_ITEMS } from "./nav-items";
import { isActivePath } from "./Sidebar";
import { authClient } from "@/lib/auth-client";
import ThemeToggle from "@/components/theme/ThemeToggle";

const RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

/** Mobile bottom tab bar, 5 slots: 4 key routes + "More" sheet (DESIGN.md §3.2). */
export default function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const tabs = MOBILE_NAV_HREFS.map(
    (href) => NAV_ITEMS.find((item) => item.href === href)!
  );
  const moreItems = NAV_ITEMS.filter((item) => !MOBILE_NAV_HREFS.includes(item.href));
  const moreActive = moreItems.some((item) => isActivePath(pathname, item.href));

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-bg/70 backdrop-blur-sm" />
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-lg border-t border-border bg-bg-subtle p-3 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] shadow-[var(--shadow-raise)] animate-toast-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs font-medium uppercase tracking-wider text-text-3">
                More
              </span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className={`grid size-8 place-items-center rounded-sm text-text-3 hover:bg-surface-2 hover:text-text transition-colors ${RING}`}
                aria-label="Close"
              >
                <X className="size-4" strokeWidth={2} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {moreItems.map(({ href, label, icon: Icon }) => {
                const active = isActivePath(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 rounded-sm px-3 py-3 text-sm font-medium transition-colors ${RING} ${
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
            </div>
            <div className="px-3 py-2">
              <ThemeToggle />
            </div>
            <button
              type="button"
              onClick={() => authClient.signOut().then(() => { window.location.href = "/login"; })}
              className={`mt-1 flex w-full items-center gap-3 rounded-sm px-3 py-3 text-sm font-medium text-text-3 hover:bg-surface hover:text-text-2 transition-colors ${RING}`}
            >
              <LogOut className="size-[18px] shrink-0" strokeWidth={2} />
              Sign out
            </button>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-bg-subtle/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)] lg:hidden">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium ${RING} ${
                active ? "text-accent" : "text-text-3"
              }`}
            >
              <Icon className="size-5" strokeWidth={2} />
              {label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium ${RING} ${
            moreActive ? "text-accent" : "text-text-3"
          }`}
        >
          <Ellipsis className="size-5" strokeWidth={2} />
          More
        </button>
      </nav>
    </>
  );
}
