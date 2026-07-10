"use client";

/**
 * Phase-based program view: Overview comparison table (Phase I/II/III) plus
 * one tab per phase showing each day's workouts with resolved sets, and the
 * Week-13 deload. Used by the AI builder preview (draft data) and the
 * Programs page (database programs).
 */
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import {
  slotSetsForPhase,
  type DraftProgram,
  type ProgramPhase,
  type VolumeRow,
} from "@/lib/ai/program-builder-types";
import type { MuscleGroup } from "@/lib/generated/prisma/enums";

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  CHEST: "Chest",
  UPPER_CHEST: "Upper chest",
  BACK: "Back",
  LATS: "Lats",
  FRONT_DELTS: "Front delts",
  LATERAL_DELTS: "Side delts",
  REAR_DELTS: "Rear delts",
  TRICEPS: "Triceps",
  BICEPS: "Biceps",
  FOREARMS: "Forearms",
  QUADS: "Quads",
  HAMSTRINGS: "Hamstrings",
  GLUTES: "Glutes",
  CALVES: "Calves",
  CORE: "Core",
};

export interface PhaseViewSlot {
  exercise: string;
  sets: number;
  repMin: number;
  repMax: number;
  isPerSide: boolean;
  isNew?: boolean;
}

export interface PhaseViewDay {
  name: string;
  editHref?: string;
  slots: PhaseViewSlot[];
}

export interface PhaseViewData {
  days: PhaseViewDay[];
  block2AddSets: Array<{ day: number; exercise: string }>;
  block3AddSets: Array<{ day: number; exercise: string; addSets: number }>;
  volumeByPhase: [VolumeRow[], VolumeRow[], VolumeRow[]];
  effortText: string;
}

const PHASE_TABS: Array<{ label: string; phase: ProgramPhase | null }> = [
  { label: "Overview", phase: null },
  { label: "Weeks 1–4", phase: 1 },
  { label: "Weeks 5–8", phase: 2 },
  { label: "Weeks 9–12", phase: 3 },
  { label: "Week 13", phase: "deload" },
];

const PHASE_META: Record<1 | 2 | 3, { title: string; objective: string; expect: string }> = {
  1: {
    title: "Foundation",
    objective: "Groove technique and build the base volume every later phase stands on.",
    expect: "Weights climb steadily via double progression as you own each rep range.",
  },
  2: {
    title: "Build",
    objective: "Add volume to the priority lifts now that recovery is established.",
    expect: "Extra sets land on priority exercises; sessions run slightly longer.",
  },
  3: {
    title: "Specialize",
    objective: "Peak volume on the priority muscles before the deload.",
    expect: "The hardest weeks of the cycle — fatigue is expected, the deload is coming.",
  },
};

/** slotSetsForPhase only reads the block-add arrays off the draft. */
function asDraft(data: PhaseViewData): DraftProgram {
  return {
    name: "",
    description: "",
    days: [],
    block2AddSets: data.block2AddSets,
    block3AddSets: data.block3AddSets,
  };
}

function phaseTotalSets(data: PhaseViewData, phase: ProgramPhase): number {
  const draft = asDraft(data);
  return data.days.reduce(
    (sum, day, di) =>
      sum +
      day.slots.reduce(
        (s, slot) => s + slotSetsForPhase(draft, di + 1, slot.exercise, slot.sets, phase),
        0,
      ),
    0,
  );
}

function PhaseDayCards({ data, phase }: { data: PhaseViewData; phase: ProgramPhase }) {
  const draft = asDraft(data);
  return (
    <>
      {data.days.map((day, di) => (
        <Card key={di} className="self-start overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-border-faint px-4 py-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-accent">Day {di + 1}</p>
              <h4 className="mt-0.5 text-sm font-semibold text-text">{day.name}</h4>
            </div>
            {day.editHref && (
              <ButtonLink href={day.editHref} variant="subtle" size="sm">
                Edit
              </ButtonLink>
            )}
          </div>
          <ul className="divide-y divide-border-faint">
            {day.slots.map((slot, si) => {
              const sets = slotSetsForPhase(draft, di + 1, slot.exercise, slot.sets, phase);
              const changed = phase !== "deload" && sets !== slot.sets;
              return (
                <li key={si} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0 truncate text-sm text-text">
                    {slot.exercise}
                    {slot.isNew && (
                      <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                        new
                      </span>
                    )}
                  </span>
                  <span
                    className={`shrink-0 text-xs tabular-nums ${changed ? "font-semibold text-accent" : "text-text-3"}`}
                  >
                    {sets} × {slot.repMin === slot.repMax ? slot.repMax : `${slot.repMin}–${slot.repMax}`}
                    {slot.isPerSide ? " each" : ""}
                    {changed && ` (+${sets - slot.sets})`}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </>
  );
}

function VolumeCard({ volume, label }: { volume: VolumeRow[]; label: string }) {
  return (
    <Card className="self-start p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-text-3">{label}</h4>
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5">
        {volume.map((row) => (
          <div key={row.muscle} className="flex items-center justify-between text-xs">
            <span className="text-text-3">{MUSCLE_LABELS[row.muscle]}</span>
            <span className="tabular-nums text-text">
              {row.directSets}
              {row.indirectSets > 0 && <span className="text-text-faint"> +{row.indirectSets}</span>}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-text-faint">
        Direct weekly sets, with secondary-muscle sets after the +.
      </p>
    </Card>
  );
}

function OverviewTable({ data }: { data: PhaseViewData }) {
  const phases = [1, 2, 3] as const;
  const changes: Record<1 | 2 | 3, string> = {
    1: "Baseline sets on every exercise.",
    2:
      data.block2AddSets.length > 0
        ? `+1 set to ${data.block2AddSets.length} priority ${data.block2AddSets.length === 1 ? "exercise" : "exercises"}.`
        : "Same sets — progress through weight and reps.",
    3:
      data.block3AddSets.length > 0
        ? `+${data.block3AddSets.reduce((s, a) => s + a.addSets, 0)} sets/week vs baseline across ${data.block3AddSets.length} ${data.block3AddSets.length === 1 ? "exercise" : "exercises"}.`
        : "Same sets — progress through weight and reps.",
  };
  const rows: Array<{ label: string; render: (p: 1 | 2 | 3) => string }> = [
    { label: "Objective", render: (p) => PHASE_META[p].objective },
    { label: "What to expect", render: (p) => PHASE_META[p].expect },
    { label: "Weeks", render: (p) => (p === 1 ? "1–4" : p === 2 ? "5–8" : "9–12") },
    { label: "Sessions", render: () => `${data.days.length}/week` },
    { label: "Weekly working sets", render: (p) => String(phaseTotalSets(data, p)) },
    { label: "Volume changes", render: (p) => changes[p] },
    { label: "Effort", render: () => data.effortText },
    {
      label: "Rest between sets",
      render: () => "2–3 min compounds · 60–90s isolation (shown per exercise in the app)",
    },
  ];
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-xs">
        <thead>
          <tr className="border-b border-border-faint">
            <th className="px-4 py-3" />
            {phases.map((p) => (
              <th key={p} className="px-4 py-3 align-top">
                <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                  Phase {p === 1 ? "I" : p === 2 ? "II" : "III"}
                </span>
                <span className="block font-display text-sm font-semibold text-text">
                  {PHASE_META[p].title}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-faint">
          {rows.map((row) => (
            <tr key={row.label} className="align-top">
              <th className="whitespace-nowrap px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-3">
                {row.label}
              </th>
              {phases.map((p) => (
                <td key={p} className="px-4 py-2.5 leading-relaxed text-text">
                  {row.render(p)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border-faint px-4 py-3 text-[11px] leading-relaxed text-text-faint">
        Every phase progresses weight by double progression: own the top of the rep range on all
        sets and the app raises the load. Week 13 is an automatic deload — half the sets at ~82%
        of your working weights — then the next 13-week cycle begins.
      </p>
    </Card>
  );
}

export default function ProgramPhaseView({ data }: { data: PhaseViewData }) {
  const [tab, setTab] = useState(0);
  const phase = PHASE_TABS[tab].phase;

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex flex-wrap gap-1.5">
        {PHASE_TABS.map((t, i) => (
          <button
            key={t.label}
            role="tab"
            aria-selected={i === tab}
            onClick={() => setTab(i)}
            className={`rounded-sm border px-3 py-1.5 text-xs font-medium transition-colors ${
              i === tab
                ? "border-accent/60 bg-accent/15 text-accent"
                : "border-border bg-surface-2 text-text-3 hover:border-border-strong"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {phase === null ? (
        <OverviewTable data={data} />
      ) : (
        <>
          <p className="text-sm text-text-3">
            {phase === "deload" ? (
              <>
                <span className="font-semibold text-text">Deload.</span> Half the sets at ~82% of
                your working weights — recover, then the next cycle begins.
              </>
            ) : (
              <>
                <span className="font-semibold text-text">{PHASE_META[phase].title}.</span>{" "}
                {PHASE_META[phase].objective}
                {phase !== 1 && (
                  <span className="text-accent"> Set increases vs weeks 1–4 are highlighted.</span>
                )}
              </>
            )}
          </p>
          <div className="grid gap-4 xl:grid-cols-2">
            <PhaseDayCards data={data} phase={phase} />
            {phase !== "deload" && (
              <VolumeCard
                volume={data.volumeByPhase[phase - 1]}
                label={`Weekly sets per muscle (${PHASE_TABS[tab].label.toLowerCase()})`}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
