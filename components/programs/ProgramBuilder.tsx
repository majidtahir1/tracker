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
import ProgramPhaseView, {
  MUSCLE_LABELS,
  type PhaseViewData,
} from "@/components/programs/ProgramPhaseView";
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
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const stepTimer = setInterval(
      () => setIndex((i) => Math.min(i + 1, steps.length - 1)),
      refining ? 4000 : 3200,
    );
    const clock = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      clearInterval(stepTimer);
      clearInterval(clock);
    };
  }, [steps.length, refining]);

  const exhausted = index >= steps.length - 1;
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
      {exhausted && seconds > (refining ? 25 : 40) && (
        <p className="pl-6.5 text-xs text-text-3">
          Still working — {seconds}s in. Long drafts occasionally take a couple of minutes; it
          will stop and tell you if something went wrong.
        </p>
      )}
    </div>
  );
}

function DraftPreview({
  draft,
  volumeByPhase,
  beginner,
  onRename,
}: {
  draft: DraftProgram;
  volumeByPhase: [VolumeRow[], VolumeRow[], VolumeRow[]];
  beginner: boolean;
  onRename: (name: string) => void;
}) {
  const data: PhaseViewData = {
    days: draft.days.map((day) => ({
      name: day.name,
      slots: day.slots.map((slot) => ({
        exercise: slot.exercise,
        sets: slot.sets,
        repMin: slot.repMin,
        repMax: slot.repMax,
        isPerSide: slot.isPerSide,
        isNew: Boolean(slot.newExercise),
      })),
    })),
    block2AddSets: draft.block2AddSets,
    block3AddSets: draft.block3AddSets,
    volumeByPhase,
    effortText: beginner
      ? "2\u20133 reps in reserve on compounds, 1\u20132 on isolation"
      : "1\u20132 reps in reserve on compounds, 0\u20131 on isolation",
  };
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
      <ProgramPhaseView data={data} />
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
  const [volumeByPhase, setVolumeByPhase] = useState<
    [VolumeRow[], VolumeRow[], VolumeRow[]] | null
  >(null);
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
      let result: Awaited<ReturnType<typeof runBuilderTurn>>;
      try {
        result = await runBuilderTurn({ intake: intake(), history, userMessage });
      } catch {
        setError("Lost the connection while generating (was the server restarted?). Try again.");
        return;
      }
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
      setVolumeByPhase(result.volumeByPhase);
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
      let result: Awaited<ReturnType<typeof finalizeDraftProgram>>;
      try {
        result = await finalizeDraftProgram(draft, {
          activate,
          beginner: experience === "BEGINNER",
        });
      } catch {
        setError("Lost the connection while saving. Your draft is still here — try again.");
        return;
      }
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,4fr)]">
      <div className="flex flex-col gap-4 lg:sticky lg:top-8 lg:h-[calc(100dvh-4rem)] lg:self-start">
        <Card className="flex max-h-[32rem] flex-col overflow-y-auto p-4 lg:max-h-none lg:min-h-0 lg:flex-1">
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
          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
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
        {draft && volumeByPhase && (
          <DraftPreview
            draft={draft}
            volumeByPhase={volumeByPhase}
            beginner={experience === "BEGINNER"}
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
