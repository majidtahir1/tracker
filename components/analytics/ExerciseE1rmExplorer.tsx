"use client";

/**
 * Selectable-exercise e1RM chart: local <select> over all exercises with
 * logged data; reuses E1rmChart. Data arrives pre-shaped from the server.
 */
import { useState } from "react";
import { ChevronDown, ChartLine } from "lucide-react";
import E1rmChart from "./E1rmChart";
import EmptyState from "@/components/ui/EmptyState";
import type { ExerciseSeries } from "@/lib/queries/analytics";

export default function ExerciseE1rmExplorer({ allSeries }: { allSeries: ExerciseSeries[] }) {
  const [selected, setSelected] = useState(allSeries[0]?.name ?? "");
  const active = allSeries.find((s) => s.name === selected) ?? allSeries[0];

  if (!active) {
    return (
      <EmptyState
        chart
        icon={ChartLine}
        title="No logged exercises yet."
        body="Pick any exercise here once you've logged working sets for it."
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative mb-3 px-3">
        <select
          value={active.name}
          onChange={(e) => setSelected(e.target.value)}
          aria-label="Exercise"
          className="h-10 w-full appearance-none rounded-sm border border-border bg-surface-2 px-3.5 pr-10 text-sm text-text placeholder:text-text-faint hover:border-border-strong focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/25 transition-colors"
        >
          {allSeries.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-6 top-3 size-4 text-text-3" />
      </div>
      <div className="min-h-0 flex-1">
        <E1rmChart series={active.series} />
      </div>
    </div>
  );
}
