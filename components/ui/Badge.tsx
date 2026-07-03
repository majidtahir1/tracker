import type { ReactNode } from "react";
import { Trophy } from "lucide-react";

export type BadgeVariant =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: "bg-surface-2 text-text-3",
  success: "bg-success-muted text-success",
  warning: "bg-warning-muted text-warning",
  danger: "bg-danger-muted text-danger",
  info: "bg-info-muted text-info",
  accent: "bg-accent-muted text-accent border border-accent-border",
};

/** Badge (DESIGN.md §3.6). */
export function Badge({
  variant = "neutral",
  className = "",
  children,
}: {
  variant?: BadgeVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-xs px-2 py-0.5 text-[11px] font-semibold ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Deload chip. */
export function DeloadBadge() {
  return <Badge variant="info">DELOAD</Badge>;
}

/** Priority chips: HIGHEST → accent "FOCUS", HIGH → warning "HIGH". */
export function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "HIGHEST") return <Badge variant="accent">FOCUS</Badge>;
  if (priority === "HIGH") return <Badge variant="warning">HIGH</Badge>;
  if (priority === "MEDIUM") return <Badge variant="neutral">MEDIUM</Badge>;
  return null;
}

/**
 * PR Badge — the achievement moment (DESIGN.md §3.6). Glows and pops once on
 * mount. `type` appends the variant label, e.g. "PR · e1RM".
 */
export function PRBadge({ type }: { type?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-border bg-accent-muted px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-accent shadow-[var(--shadow-pr)] animate-pr-pop">
      <Trophy className="size-3.5" strokeWidth={2} />
      {type ? `PR · ${type}` : "PR"}
    </span>
  );
}
