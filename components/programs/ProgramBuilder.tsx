"use client";

/**
 * AI Program Builder wizard: intake form → chat refinement with a live
 * program preview → finalize (save / save & activate).
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, Loader2, Send, Sparkles } from "lucide-react";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { finalizeDraftProgram, runBuilderTurn } from "@/lib/actions/program-builder";
import type {
  BuilderIntake,
  ChatTurn,
  DraftProgram,
  VolumeRow,
} from "@/lib/ai/program-builder-types";
import { Equipment, MuscleGroup } from "@/lib/generated/prisma/enums";

const GOALS = [
  { value: "HYPERTROPHY", label: "Build muscle (hypertrophy)" },
  { value: "STRENGTH", label: "Get stronger" },
  { value: "FAT_LOSS", label: "Lose fat, keep muscle" },
  { value: "ATHLETIC", label: "Athletic performance" },
] as const;

const EXPERIENCE = [
  { value: "BEGINNER", label: "Beginner (< 1 year)" },
  { value: "INTERMEDIATE", label: "Intermediate (1-3 years)" },
  { value: "ADVANCED", label: "Advanced (3+ years)" },
] as const;

const EQUIPMENT_LABELS: Record<Equipment, string> = {
  BARBELL: "Barbell",
  DUMBBELL: "Dumbbells",
  MACHINE: "Machines",
  CABLE: "Cables",
  BODYWEIGHT: "Bodyweight",
};

const MUSCLE_LABELS: Record<MuscleGroup, string> = {
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

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-accent/60 bg-accent/15 text-accent"
          : "border-border bg-surface-2 text-text-3 hover:border-border-strong"
      }`}
    >
      {children}
    </button>
  );
}

/** Mo's design stages while generating — built from the actual intake. */
function thinkingSteps(intake: BuilderIntake, refining: boolean): string[] {
  if (refining) {
    return [
      "Re-reading the current program…",
      "Applying your change…",
      "Re-balancing weekly volume around it…",
      "Checking nothing else got knocked out of place…",
    ];
  }
  const goalLabel = GOALS.find((g) => g.value === intake.goal)?.label.toLowerCase() ?? "your goal";
  const steps = [
    `Reading your intake — ${goalLabel}, ${intake.daysPerWeek} days/week, ~${intake.sessionMinutes}-minute sessions…`,
    `Choosing a ${intake.daysPerWeek}-day split that hits every major muscle about twice a week…`,
  ];
  if (intake.priorityMuscles.length > 0) {
    steps.push(
      `Front-loading your priorities — ${intake.priorityMuscles.map((m) => MUSCLE_LABELS[m].toLowerCase()).join(", ")} — early in each session…`,
    );
  }
  if (intake.injuries.trim()) {
    steps.push(`Picking exercises that work around: ${intake.injuries.trim()}…`);
  }
  steps.push(
    `Selecting movements for your equipment (${intake.equipment.map((e) => EQUIPMENT_LABELS[e].toLowerCase()).join(", ")})…`,
    "Balancing weekly sets per muscle — enough to grow, not enough to bury you…",
    "Setting rep ranges, effort targets, and rest periods…",
    "Laying out the 13-week block progression and deload…",
    "Writing it all up…",
  );
  return steps;
}

function CoachThinking({ intake, refining }: { intake: BuilderIntake; refining: boolean }) {
  const [steps] = useState(() => thinkingSteps(intake, refining));
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(
      () => setIndex((i) => Math.min(i + 1, steps.length - 1)),
      refining ? 4000 : 3200,
    );
    return () => clearInterval(timer);
  }, [steps.length, refining]);

  return (
    <div className="space-y-2" aria-live="polite">
      {steps.slice(0, index + 1).map((step, i) => (
        <div key={i} className="flex items-start gap-2.5 text-sm">
          {i < index ? (
            <Check className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} />
          ) : (
            <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-accent" strokeWidth={2} />
          )}
          <span className={i < index ? "text-text-3" : "text-text"}>{step}</span>
        </div>
      ))}
    </div>
  );
}

function DraftPreview({
  draft,
  volume,
  onRename,
}: {
  draft: DraftProgram;
  volume: VolumeRow[];
  onRename: (name: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <input
          value={draft.name}
          onChange={(e) => onRename(e.target.value)}
          maxLength={60}
          aria-label="Program name"
          title="Click to rename the program"
          className="-mx-2 w-full rounded-sm border border-transparent bg-transparent px-2 py-1 font-display text-lg font-semibold text-text transition-colors hover:border-border focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/25"
        />
        {draft.description && <p className="mt-1 text-sm text-text-3">{draft.description}</p>}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {draft.days.map((day, di) => (
          <Card key={di} className="self-start overflow-hidden">
            <div className="border-b border-border-faint px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wider text-accent">Day {di + 1}</p>
              <h4 className="mt-0.5 text-sm font-semibold text-text">{day.name}</h4>
            </div>
            <ul className="divide-y divide-border-faint">
              {day.slots.map((slot, si) => (
                <li key={si} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0 truncate text-sm text-text">
                    {slot.exercise}
                    {slot.newExercise && (
                      <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                        new
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-text-3">
                    {slot.sets} × {slot.repMin === slot.repMax ? slot.repMax : `${slot.repMin}–${slot.repMax}`}
                    {slot.isPerSide ? " each" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
        <Card className="self-start p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-3">
            The 13-week plan
          </h4>
          <ul className="mt-3 space-y-2.5 text-xs leading-relaxed">
            <li>
              <span className="font-semibold text-text">Weeks 1–4 · Foundation.</span>{" "}
              <span className="text-text-3">
                The sets shown on the day cards. Weight goes up per exercise once you hit the top
                of the rep range on every set (double progression).
              </span>
            </li>
            <li>
              <span className="font-semibold text-text">Weeks 5–8 · Build.</span>{" "}
              <span className="text-text-3">
                {draft.block2AddSets.length > 0
                  ? `Adds a set to ${draft.block2AddSets
                      .map((a) => `${a.exercise} (day ${a.day})`)
                      .join(", ")}.`
                  : "Same sets — progression continues through added weight and reps."}
              </span>
            </li>
            <li>
              <span className="font-semibold text-text">Weeks 9–12 · Specialize.</span>{" "}
              <span className="text-text-3">
                {draft.block3AddSets.length > 0
                  ? `Versus weeks 1–4: ${draft.block3AddSets
                      .map((a) => `+${a.addSets} ${a.addSets === 1 ? "set" : "sets"} ${a.exercise} (day ${a.day})`)
                      .join(", ")}.`
                  : "Same sets — progression continues through added weight and reps."}
              </span>
            </li>
            <li>
              <span className="font-semibold text-text">Week 13 · Deload.</span>{" "}
              <span className="text-text-3">
                Automatic: half the sets at ~82% of your working weights, then the next 13-week
                cycle begins.
              </span>
            </li>
          </ul>
        </Card>
        <Card className="self-start p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-3">
            Weekly sets per muscle (weeks 1–4)
          </h4>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5">
            {volume.map((row) => (
              <div key={row.muscle} className="flex items-center justify-between text-xs">
                <span className="text-text-3">{MUSCLE_LABELS[row.muscle]}</span>
                <span className="tabular-nums text-text">
                  {row.directSets}
                  {row.indirectSets > 0 && (
                    <span className="text-text-faint"> +{row.indirectSets}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-text-faint">
            Direct sets, with secondary-muscle sets after the +. Weeks 5–12 add sets per the
            program&apos;s block progression; week 13 deloads automatically.
          </p>
        </Card>
      </div>
    </div>
  );
}

export default function ProgramBuilder({ aiConfigured }: { aiConfigured: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Intake
  const [goal, setGoal] = useState<BuilderIntake["goal"]>("HYPERTROPHY");
  const [experience, setExperience] = useState<BuilderIntake["experience"]>("BEGINNER");
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [sessionMinutes, setSessionMinutes] = useState(60);
  const [equipment, setEquipment] = useState<Equipment[]>(["DUMBBELL", "CABLE", "BODYWEIGHT"]);
  const [priorityMuscles, setPriorityMuscles] = useState<MuscleGroup[]>([]);
  const [injuries, setInjuries] = useState("");
  const [notes, setNotes] = useState("");

  // Conversation
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [displayChat, setDisplayChat] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [draft, setDraft] = useState<DraftProgram | null>(null);
  const [volume, setVolume] = useState<VolumeRow[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ name: string; activated: boolean } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  // Once the user types a name, chat refinements keep it instead of the model's.
  const renamedRef = useRef(false);

  const started = history.length > 0;

  function toggle<T>(list: T[], value: T, set: (v: T[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function intake(): BuilderIntake {
    return { goal, experience, daysPerWeek, sessionMinutes, equipment, priorityMuscles, injuries, notes };
  }

  function submitTurn(userMessage: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await runBuilderTurn({ intake: intake(), history, userMessage });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setHistory(result.history);
      if (started && userMessage) {
        setDisplayChat((c) => [...c, { role: "user", text: userMessage }, { role: "assistant", text: result.message }]);
      } else {
        setDisplayChat([{ role: "assistant", text: result.message }]);
      }
      setDraft(
        renamedRef.current && draft?.name.trim()
          ? { ...result.draft, name: draft.name }
          : result.draft,
      );
      setVolume(result.volume);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });
  }

  function generate(e: React.FormEvent) {
    e.preventDefault();
    if (equipment.length === 0) {
      setError("Pick at least one equipment type.");
      return;
    }
    submitTurn(null);
  }

  function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    const text = message.trim();
    setMessage("");
    submitTurn(text);
  }

  function finalize(activate: boolean) {
    if (!draft) return;
    if (draft.name.trim().length < 2) {
      setError("Give the program a name (at least 2 characters) before saving.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await finalizeDraftProgram(draft, {
        activate,
        beginner: experience === "BEGINNER",
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved({ name: result.programName, activated: activate });
      setTimeout(() => router.push("/programs"), 1600);
    });
  }

  if (!aiConfigured) {
    return (
      <Card className="p-6">
        <p className="text-sm text-text-3">
          The AI service is not configured. Set <code className="text-text">MINIMAX_API_KEY</code>{" "}
          in your environment to use the program builder.
        </p>
      </Card>
    );
  }

  if (saved) {
    return (
      <Card className="flex items-center gap-3 p-6">
        <Check className="size-5 text-accent" strokeWidth={2} />
        <p className="text-sm text-text">
          <span className="font-semibold">{saved.name}</span> saved
          {saved.activated ? " and set as your active program" : ""}. Taking you to Programs…
        </p>
      </Card>
    );
  }

  if (!started) {
    return (
      <form onSubmit={generate} className="max-w-2xl space-y-5">
        <Card className="space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="goal">Primary goal</Label>
              <Select id="goal" value={goal} onChange={(e) => setGoal(e.target.value as BuilderIntake["goal"])}>
                {GOALS.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="experience">Experience</Label>
              <Select
                id="experience"
                value={experience}
                onChange={(e) => setExperience(e.target.value as BuilderIntake["experience"])}
              >
                {EXPERIENCE.map((x) => (
                  <option key={x.value} value={x.value}>{x.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="days">Training days per week</Label>
              <Select id="days" value={daysPerWeek} onChange={(e) => setDaysPerWeek(Number(e.target.value))}>
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n} days</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="minutes">Session length</Label>
              <Select
                id="minutes"
                value={sessionMinutes}
                onChange={(e) => setSessionMinutes(Number(e.target.value))}
              >
                {[30, 45, 60, 75, 90].map((n) => (
                  <option key={n} value={n}>~{n} minutes</option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label>Equipment available</Label>
            <div className="flex flex-wrap gap-2">
              {Object.values(Equipment).map((eq) => (
                <Chip key={eq} active={equipment.includes(eq)} onClick={() => toggle(equipment, eq, setEquipment)}>
                  {EQUIPMENT_LABELS[eq]}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <Label>Priority muscles (optional)</Label>
            <div className="flex flex-wrap gap-2">
              {Object.values(MuscleGroup).map((m) => (
                <Chip
                  key={m}
                  active={priorityMuscles.includes(m)}
                  onClick={() => toggle(priorityMuscles, m, setPriorityMuscles)}
                >
                  {MUSCLE_LABELS[m]}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="injuries">Injuries or limitations (optional)</Label>
            <Input
              id="injuries"
              value={injuries}
              onChange={(e) => setInjuries(e.target.value)}
              placeholder="e.g. cranky right shoulder, avoid barbell back squats"
              maxLength={300}
            />
          </div>

          <div>
            <Label htmlFor="notes">Anything else? (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. I love hip thrusts, hate lunges, train in a garage gym"
              rows={2}
              maxLength={500}
            />
          </div>
        </Card>

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? (
            <><Loader2 className="size-5 animate-spin" strokeWidth={2} /> Designing your program…</>
          ) : (
            <><Sparkles className="size-5" strokeWidth={2} /> Generate program</>
          )}
        </Button>
        {pending && (
          <Card className="p-4">
            <CoachThinking intake={intake()} refining={false} />
          </Card>
        )}
      </form>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <Card className="flex max-h-[32rem] flex-col overflow-y-auto p-4">
          <div className="space-y-4">
            {displayChat.map((turn, i) =>
              turn.role === "assistant" ? (
                <div key={i} className="flex gap-2.5">
                  <Bot className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} />
                  <p className="whitespace-pre-line text-sm leading-relaxed text-text">{turn.text}</p>
                </div>
              ) : (
                <p key={i} className="ml-auto max-w-[85%] rounded-sm bg-surface-2 px-3 py-2 text-sm text-text">
                  {turn.text}
                </p>
              ),
            )}
            {pending && <CoachThinking intake={intake()} refining />}
            <div ref={chatEndRef} />
          </div>
        </Card>

        <form onSubmit={sendChat} className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder='e.g. "swap barbell rows for something shoulder-friendly"'
            disabled={pending}
            maxLength={2000}
          />
          <Button disabled={pending || !message.trim()} aria-label="Send">
            <Send className="size-4" strokeWidth={2} />
          </Button>
        </form>

        {error && <p className="text-sm text-danger">{error}</p>}

        {draft && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="lg" disabled={pending} onClick={() => finalize(true)} className="flex-1">
              <Check className="size-5" strokeWidth={2} /> Save &amp; make active
            </Button>
            <Button size="lg" variant="subtle" disabled={pending} onClick={() => finalize(false)} className="flex-1">
              Save to programs
            </Button>
          </div>
        )}
      </div>

      <div>
        {draft && (
          <DraftPreview
            draft={draft}
            volume={volume}
            onRename={(name) => {
              renamedRef.current = true;
              setDraft({ ...draft, name });
            }}
          />
        )}
      </div>
    </div>
  );
}
