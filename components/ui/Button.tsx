import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

export type ButtonVariant = "primary" | "ghost" | "danger" | "subtle";
export type ButtonSize = "sm" | "md" | "lg";

const RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

const BASE = `inline-flex items-center justify-center gap-2 rounded-sm text-sm font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none ${RING}`;

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-text hover:bg-accent-hover active:bg-accent-press",
  ghost:
    "border border-border bg-transparent text-text-2 hover:bg-surface-2 hover:text-text hover:border-border-strong",
  danger: "bg-danger-muted text-danger border border-danger/25 hover:bg-danger/25",
  subtle: "text-text-3 hover:text-text hover:bg-surface-2",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4",
  lg: "h-12 px-6 text-base",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}`;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** Button (DESIGN.md §3.8). */
export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return <button className={`${buttonClasses(variant, size)} ${className}`} {...props} />;
}

/** Link styled as a button (same recipes). */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${buttonClasses(variant, size)} ${className}`}>
      {children}
    </Link>
  );
}

/** Icon-only button: size-9 (md) / size-8 (sm), Ghost styling (DESIGN.md §3.8). */
export function IconButton({
  size = "md",
  className = "",
  ...props
}: Omit<ButtonProps, "variant" | "size"> & { size?: "sm" | "md" }) {
  return (
    <button
      className={`${BASE} ${VARIANTS.ghost} ${size === "sm" ? "size-8" : "size-9"} p-0 ${className}`}
      {...props}
    />
  );
}
