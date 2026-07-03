"use client";

/** Chart range toggle (DESIGN.md §3.5): 4W / 12W / 6M / All. Client-only. */
export default function RangeToggle({
  options = ["4W", "12W", "6M", "All"],
  active,
  onChange,
}: {
  options?: string[];
  active: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="inline-flex rounded-sm border border-border bg-bg-subtle p-0.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-[6px] px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
            option === active ? "bg-surface-2 text-text" : "text-text-3"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
