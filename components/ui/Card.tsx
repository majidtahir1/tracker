import type { ReactNode } from "react";

/** Bare card shell (DESIGN.md: every card is bg-surface border-border rounded-md). */
export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`rounded-md border border-border bg-surface shadow-[var(--shadow-card)] ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Section Card (DESIGN.md §3.3): header row + body.
 * Pass `flush` for p-0 bodies (tables/lists).
 */
export function SectionCard({
  title,
  action,
  flush = false,
  className = "",
  children,
}: {
  title: string;
  action?: ReactNode;
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
      <div className="flex items-center justify-between border-b border-border-faint px-5 py-4">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {action}
      </div>
      <div className={flush ? "p-0" : "p-5"}>{children}</div>
    </Card>
  );
}

/** Header action link recipe ("View all →"). */
export function CardAction({ children }: { children: ReactNode }) {
  return (
    <span className="text-xs font-medium text-text-3 hover:text-accent transition-colors">
      {children}
    </span>
  );
}
