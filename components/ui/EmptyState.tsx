import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Empty state (DESIGN.md §3.13). Copy should be athletic and direct.
 * `chart` variant drops the dashed border (for inside chart bodies).
 */
export default function EmptyState({
  icon: Icon,
  title,
  body,
  cta,
  chart = false,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  /** Primary sm button (or link) — action-first. */
  cta?: ReactNode;
  chart?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-6 py-16 text-center ${
        chart ? "" : "rounded-md border border-dashed border-border"
      }`}
    >
      <Icon className="size-10 text-text-faint" strokeWidth={1.75} />
      <p className="mt-4 text-sm font-semibold text-text">{title}</p>
      {body && <p className="mt-1 max-w-xs text-xs text-text-3">{body}</p>}
      {cta && <div className="mt-5">{cta}</div>}
    </div>
  );
}
