/** Progress bar (DESIGN.md §3.7). */
export default function ProgressBar({
  pct,
  label,
  valueLabel,
  thick = false,
  behindPace = false,
}: {
  /** 0–100+ (clamped for width; ≥100 turns the fill green). */
  pct: number;
  label?: string;
  /** Right-aligned value, e.g. "185 / 225 lb". */
  valueLabel?: string;
  /** Goals-page variant (h-3). */
  thick?: boolean;
  /** Goals-page behind-pace variant (amber fill). */
  behindPace?: boolean;
}) {
  const width = Math.min(Math.max(pct, 0), 100);
  const fillColor = pct >= 100 ? "bg-success" : behindPace ? "bg-warning" : "bg-accent";

  return (
    <div>
      {(label || valueLabel) && (
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-text-3">{label}</span>
          <span className="tabular-nums text-text-2">{valueLabel}</span>
        </div>
      )}
      <div
        className={`${label || valueLabel ? "mt-1.5 " : ""}${thick ? "h-3" : "h-2"} w-full overflow-hidden rounded-full bg-surface-2`}
      >
        <div
          className={`h-full rounded-full ${fillColor} transition-[width] duration-500 ease-out`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
