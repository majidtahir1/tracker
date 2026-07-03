import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { ChevronDown } from "lucide-react";

/** Form input recipes (DESIGN.md §3.9) — dark, 44px+ touch targets. */

const INPUT_BASE =
  "h-12 w-full rounded-sm border bg-surface-2 px-3.5 text-base text-text placeholder:text-text-faint transition-colors focus:outline-none";

function borderClasses(error?: boolean) {
  return error
    ? "border-danger/60 hover:border-danger/60 focus:border-danger/60 focus:ring-2 focus:ring-danger/25"
    : "border-border hover:border-border-strong focus:border-accent/60 focus:ring-2 focus:ring-accent/25";
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-text-3">
      {children}
    </label>
  );
}

export function FieldError({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-xs text-danger">{children}</p>;
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  /** Numeric styling: right-aligned tabular display font + decimal keypad. */
  numeric?: boolean;
}

export function Input({ error, numeric, className = "", ...props }: InputProps) {
  return (
    <input
      className={`${INPUT_BASE} ${borderClasses(error)} ${
        numeric ? "text-right tabular-nums font-display text-lg" : ""
      } ${className}`}
      inputMode={numeric ? "decimal" : props.inputMode}
      {...props}
    />
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export function Select({ error, className = "", children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={`${INPUT_BASE} ${borderClasses(error)} appearance-none bg-no-repeat pr-10 ${className}`}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-3"
        strokeWidth={2}
      />
    </div>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export function Textarea({ error, className = "", ...props }: TextareaProps) {
  return (
    <textarea
      className={`${INPUT_BASE} h-auto min-h-24 py-3 ${borderClasses(error)} ${className}`}
      {...props}
    />
  );
}
