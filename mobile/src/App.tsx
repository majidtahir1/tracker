import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  Check,
  ChevronRight,
  Dumbbell,
  Ellipsis,
  History,
  Library,
  Loader2,
  LogOut,
  RefreshCw,
  Settings,
  Shield,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { PushNotifications } from "@capacitor/push-notifications";
import { API_URL, authorizedBlob, data, getSession, loadToken, post, request, saveToken, signIn, signOut, signUp, upload } from "./api";

type View = "dashboard" | "workout" | "history" | "analytics" | "exercises" | "records" | "recovery" | "programs" | "photos" | "settings";
type User = { id: string; name: string; username?: string };
type Json = Record<string, any>;
type BuilderIntake = {
  goal: string;
  experience: string;
  daysPerWeek: number;
  sessionMinutes: number;
  equipment: string[];
  priorityMuscles: string[];
  injuries: string;
  notes: string;
};

const BUILDER_GOALS = [
  ["HYPERTROPHY", "Build muscle"],
  ["STRENGTH", "Get stronger"],
  ["FAT_LOSS", "Lose fat, keep muscle"],
  ["ATHLETIC", "Athletic performance"],
] as const;
const BUILDER_EXPERIENCE = [
  ["BEGINNER", "Beginner (< 1 year)"],
  ["INTERMEDIATE", "Intermediate (1-3 years)"],
  ["ADVANCED", "Advanced (3+ years)"],
] as const;
const BUILDER_EQUIPMENT = ["BARBELL", "DUMBBELL", "MACHINE", "CABLE", "BODYWEIGHT"];
const BUILDER_MUSCLES = ["CHEST", "BACK", "LATS", "LATERAL_DELTS", "REAR_DELTS", "TRICEPS", "BICEPS", "QUADS", "HAMSTRINGS", "GLUTES", "CALVES", "CORE"];

const PRIMARY: Array<{ id: View; label: string; icon: typeof Dumbbell }> = [
  { id: "dashboard", label: "Today", icon: Activity },
  { id: "workout", label: "Workout", icon: Dumbbell },
  { id: "history", label: "History", icon: History },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];
const MORE: Array<{ id: View; label: string; icon: typeof Dumbbell }> = [
  { id: "programs", label: "Programs", icon: Dumbbell },
  { id: "exercises", label: "Exercises", icon: Library },
  { id: "records", label: "Records", icon: Trophy },
  { id: "recovery", label: "Recovery", icon: Activity },
  { id: "photos", label: "Photos", icon: Library },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [more, setMore] = useState(false);

  useEffect(() => {
    void (async () => {
      const stored = await loadToken();
      if (stored) {
        try { setUser((await getSession()).user); } catch { await saveToken(null); }
      }
      setBooting(false);
    })();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  if (booting) return <Centered><Loader2 className="spin" size={28} /></Centered>;
  if (!user) return <AuthScreen onAuthenticated={async () => setUser((await getSession()).user)} />;

  const screens: Record<View, React.ReactNode> = {
    dashboard: <DashboardScreen openWorkout={() => setView("workout")} />,
    workout: <WorkoutScreen />,
    history: <HistoryScreen />,
    analytics: <AnalyticsScreen />,
    exercises: <ExercisesScreen />,
    records: <RecordsScreen />,
    recovery: <RecoveryScreen />,
    programs: <ProgramsScreen openSettings={() => setView("settings")} />,
    photos: <PhotosScreen />,
    settings: <SettingsScreen user={user} onSignedOut={() => setUser(null)} />,
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand"><Dumbbell size={20} /><span>PROGRESSION</span></div>
        <button className="icon-button" aria-label="Refresh" onClick={() => window.location.reload()}><RefreshCw size={18} /></button>
      </header>
      <main className="app-main" key={view}>{screens[view]}</main>
      {more && (
        <div className="sheet-backdrop" onClick={() => setMore(false)}>
          <div className="sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-head"><strong>More</strong><button className="icon-button" onClick={() => setMore(false)}><X size={18} /></button></div>
            <div className="more-grid">
              {MORE.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? "more-item active" : "more-item"} onClick={() => { setView(id); setMore(false); }}><Icon size={20} />{label}</button>)}
            </div>
          </div>
        </div>
      )}
      <nav className="tab-bar">
        {PRIMARY.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? "tab active" : "tab"} onClick={() => setView(id)}><Icon size={21} /><span>{label}</span></button>)}
        <button className={MORE.some((item) => item.id === view) ? "tab active" : "tab"} onClick={() => setMore(true)}><Ellipsis size={21} /><span>More</span></button>
      </nav>
    </div>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setPending(true); setError("");
    try {
      if (mode === "login") await signIn(username, password); else await signUp(username, password);
      await onAuthenticated();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Authentication failed"); }
    finally { setPending(false); }
  }
  return <Centered>
    <div className="auth-wrap">
      <div className="auth-brand"><Dumbbell size={30} /><strong>PROGRESSION</strong></div>
      <form className="panel auth-panel" onSubmit={submit}>
        <h1>{mode === "login" ? "Sign in" : "Create account"}</h1>
        <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} required autoCapitalize="none" /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={mode === "signup" ? 6 : 1} required /></label>
        {error && <p className="error">{error}</p>}
        <button className="button primary" disabled={pending}>{pending ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}</button>
        <button type="button" className="text-button" onClick={() => setMode(mode === "login" ? "signup" : "login")}>{mode === "login" ? "Create an account" : "Use an existing account"}</button>
        <button type="button" className="policy-link" onClick={() => window.open(`${API_URL}/privacy`, "_blank")}>Privacy Policy</button>
      </form>
    </div>
  </Centered>;
}

function useData(section: string, query = "") {
  const [value, setValue] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    setLoading(true); setError("");
    try { setValue(await data(section, query)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, [section, query]);
  return { value, error, loading, reload };
}

function Screen({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) {
  return <div className="screen">{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{children}</div>;
}
function AsyncState({ loading, error }: { loading: boolean; error: string }) {
  if (loading) return <div className="loading"><Loader2 className="spin" size={22} /> Loading</div>;
  if (error) return <div className="panel error-panel">{error}</div>;
  return null;
}

function DashboardScreen({ openWorkout }: { openWorkout: () => void }) {
  const state = useData("dashboard"); const d = state.value as Json | null;
  return <Screen title="Today" eyebrow={d?.position ? `Cycle ${d.position.cycleNumber} · Week ${d.position.week} · Phase ${d.position.phase}` : "Training overview"}>
    <AsyncState loading={state.loading} error={state.error} />
    {d && <>
      <div className="metric-grid">
        <Metric label="Body weight" value={d.stats.bodyWeight?.value ? `${d.stats.bodyWeight.value} lb` : "—"} />
        <Metric label="Weekly volume" value={`${Math.round(d.stats.volumeThisWeek.value / 1000)}k lb`} />
        <Metric label="Recovery" value={d.stats.recoveryScore ?? "—"} accent />
        <Metric label="PRs this block" value={d.stats.prCountBlock} />
      </div>
      {d.coachBrief && <section className="panel coach-card">
        <div className="coach-label"><Bot size={17} /><span>{d.coachBrief.source === "minimax" ? "AI daily coach" : "Daily coach"}</span></div>
        <h2>{d.coachBrief.headline}</h2>
        <p>{d.coachBrief.message}</p>
        <blockquote>{d.coachBrief.encouragement}</blockquote>
      </section>}
      {d.nextWorkout && <button className="panel action-panel" onClick={openWorkout}><div><span className="kicker">NEXT WORKOUT · {d.nextWorkout.dateLabel}</span><h2>{d.nextWorkout.templateName}</h2><p>{d.nextWorkout.exerciseCount} exercises · about {d.nextWorkout.estMinutes} min</p></div><ChevronRight /></button>}
      {d.lastWorkout && <section><h2 className="section-title">Last workout</h2><div className="panel list-panel"><div className="list-row"><div><strong>{d.lastWorkout.templateName}</strong><small>{d.lastWorkout.dateLabel}</small></div><span>{Math.round(d.lastWorkout.totalVolume).toLocaleString()} lb</span></div>{d.lastWorkout.exercises.slice(0, 4).map((ex: Json) => <div className="list-row compact" key={ex.name}><span>{ex.name}</span><small>{ex.topSet}</small></div>)}</div></section>}
    </>}
  </Screen>;
}

function Metric({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) { return <div className="metric"><span>{label}</span><strong className={accent ? "accent" : ""}>{value}</strong></div>; }

function WorkoutScreen() {
  const overview = useData("workout");
  const [sessionId, setSessionId] = useState<string | null>(null);
  useEffect(() => { if (overview.value?.inProgress?.id) setSessionId(overview.value.inProgress.id); }, [overview.value]);
  if (sessionId) return <SessionLogger id={sessionId} onFinished={() => { setSessionId(null); void overview.reload(); }} />;
  const d = overview.value;
  async function start() {
    if (!d?.next) return;
    const result = await post<Json>("/api/mobile/workout", { action: "start", templateId: d.next.templateId, date: d.next.date, scheduleOverride: d.next.isOverride });
    if (result.ok) setSessionId(result.sessionId);
  }
  return <Screen title="Next workout" eyebrow={d?.position ? `Week ${d.position.week} · Phase ${d.position.phase}` : "Workout"}>
    <AsyncState loading={overview.loading} error={overview.error} />
    {d?.next ? <><div className="panel workout-head"><span className="kicker">{d.next.dateLabel}</span><h2>{d.next.templateName}</h2><p>{d.next.totalSets} sets · about {d.next.estMinutes} min</p><button className="button primary full" onClick={start}>Start workout</button></div><div className="panel list-panel">{d.next.exercises.map((ex: Json) => <div className="list-row" key={ex.templateExerciseId}><div><strong>{ex.name}</strong><small>{ex.sets} × {ex.repMin}-{ex.repMax} · RIR {ex.rirMin}-{ex.rirMax}</small></div><span>{ex.weight == null ? "First time" : `${ex.weight} lb`}</span></div>)}</div></> : !overview.loading && <div className="panel empty">Choose and activate a program to begin training.</div>}
  </Screen>;
}

function SessionLogger({ id, onFinished }: { id: string; onFinished: () => void }) {
  const detail = useData("session", `?id=${encodeURIComponent(id)}`); const d = detail.value;
  async function finish() { const result = await post<Json>("/api/mobile/workout", { action: "finish", sessionId: id }); if (result.ok) onFinished(); }
  return <Screen title={d?.session?.name || "Workout"} eyebrow={d?.session ? `Week ${d.session.weekInCycle}${d.session.isDeload ? " · Deload" : ""}` : "Active session"}>
    <AsyncState loading={detail.loading} error={detail.error} />
    {d?.session?.exercises.map((ex: Json) => <ExerciseLogger key={ex.sessionExerciseId} exercise={ex} refresh={detail.reload} />)}
    {d && <button className="button primary full finish" onClick={finish}>Finish workout</button>}
  </Screen>;
}

function ExerciseLogger({ exercise, refresh }: { exercise: Json; refresh: () => Promise<void> }) {
  const existing = new Map<number, Json>(exercise.sets.map((set: Json) => [set.setNumber, set]));
  const rows = Array.from({ length: Math.max(exercise.targetSets, exercise.sets.length) }, (_, index) => index + 1);
  return <section className="panel exercise-panel"><div className="exercise-title"><div><h2>{exercise.name}</h2><p>{exercise.targetSets} × {exercise.targetRepMin}-{exercise.targetRepMax} · RIR {exercise.targetRirMin}-{exercise.targetRirMax}</p></div>{exercise.targetWeight != null && <span className="weight-target">{exercise.targetWeight} lb</span>}</div>{rows.map((number) => <SetRow key={number} exerciseId={exercise.sessionExerciseId} number={number} initial={existing.get(number)} targetWeight={exercise.targetWeight} refresh={refresh} />)}</section>;
}

function SetRow({ exerciseId, number, initial, targetWeight, refresh }: { exerciseId: string; number: number; initial?: Json; targetWeight: number | null; refresh: () => Promise<void> }) {
  const [weight, setWeight] = useState(String(initial?.weight ?? targetWeight ?? "")); const [reps, setReps] = useState(String(initial?.reps ?? "")); const [rir, setRir] = useState(String(initial?.rir ?? "")); const [saving, setSaving] = useState(false);
  async function save() { setSaving(true); await post("/api/mobile/workout", { action: "logSet", sessionExerciseId: exerciseId, setNumber: number, weight: Number(weight), reps: Number(reps), rir: rir === "" ? null : Number(rir), completed: true }); await refresh(); setSaving(false); }
  return <div className={initial?.completed ? "set-row complete" : "set-row"}><span className="set-number">{number}</span><label>lb<input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></label><label>reps<input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} /></label><label>RIR<input inputMode="numeric" value={rir} onChange={(e) => setRir(e.target.value)} /></label><button className="set-save" disabled={saving || weight === "" || reps === ""} onClick={save}>{saving ? "..." : initial?.completed ? "Saved" : "Done"}</button></div>;
}

function HistoryScreen() { const state = useData("history"); const groups = state.value as Json[] | null; return <Screen title="History" eyebrow="Training log"><AsyncState loading={state.loading} error={state.error} />{groups?.map((group) => <section key={group.weekStart}><h2 className="section-title">{group.label}</h2><div className="panel list-panel">{group.sessions.map((session: Json) => <div className="list-row" key={session.id}><div><strong>{session.name}</strong><small>{session.dateLabel} · {session.completedSets}/{session.targetSets} sets</small></div><span>{session.status === "COMPLETED" ? `${Math.round(session.totalVolume).toLocaleString()} lb` : session.status}</span></div>)}</div></section>)}{groups?.length === 0 && <div className="panel empty">Completed workouts will appear here.</div>}</Screen>; }

function AnalyticsScreen() { const state = useData("analytics", "?range=12W"); const d = state.value; return <Screen title="Analytics" eyebrow="Last 12 weeks"><AsyncState loading={state.loading} error={state.error} />{d && <><div className="metric-grid"><Metric label="Sessions" value={d.frequency?.reduce((n: number, week: Json) => n + (week.completed ?? 0), 0) ?? "—"} /><Metric label="Exercise trends" value={d.e1rmSeries?.length ?? 0} /><Metric label="WHOOP connected" value={d.whoop ? "Yes" : "No"} accent /></div><DataSummary value={d} /></>}</Screen>; }

function ExercisesScreen() { const state = useData("exercises"); const [search, setSearch] = useState(""); const list = useMemo(() => (state.value || []).filter((x: Json) => x.name.toLowerCase().includes(search.toLowerCase())), [state.value, search]); return <Screen title="Exercises" eyebrow={`${list.length} movements`}><input className="search" placeholder="Search exercises" value={search} onChange={(e) => setSearch(e.target.value)} /><AsyncState loading={state.loading} error={state.error} /><div className="panel list-panel">{list.map((ex: Json) => <div className="list-row" key={ex.id}><div><strong>{ex.name}</strong><small>{pretty(ex.primaryMuscle)} · {pretty(ex.equipment)}</small></div>{ex.isFavorite && <span className="accent">Favorite</span>}</div>)}</div></Screen>; }

function RecordsScreen() { const state = useData("records"); const d = state.value; return <Screen title="Records" eyebrow={d ? `${d.totalPrs} personal records` : "Personal bests"}><AsyncState loading={state.loading} error={state.error} />{d && <div className="panel list-panel">{d.timeline.map((row: Json) => <div className="list-row" key={row.id}><div><strong>{row.exerciseName}</strong><small>{row.date} · {pretty(row.type)}</small></div><span>{Math.round(row.value * 10) / 10}</span></div>)}</div>}</Screen>; }

function RecoveryScreen() { const state = useData("recovery"); const d = state.value; return <Screen title="Recovery" eyebrow={d?.latestSource ? `${pretty(d.latestSource)} data` : "Readiness"}><AsyncState loading={state.loading} error={state.error} />{d && <><div className="recovery-score"><strong>{d.latestScore ?? "—"}</strong><span>{d.latestBand ? pretty(d.latestBand) : "No score"}</span></div>{d.whoopToday && <div className="metric-grid"><Metric label="HRV" value={d.whoopToday.hrvMs ? `${d.whoopToday.hrvMs} ms` : "—"} /><Metric label="Resting HR" value={d.whoopToday.restingHr ?? "—"} /><Metric label="Sleep" value={d.whoopToday.sleepHours ? `${d.whoopToday.sleepHours} h` : "—"} /></div>}<DataSummary value={{ trend: d.trend }} /></>}</Screen>; }

function ProgramsScreen({ openSettings }: { openSettings: () => void }) {
  const state = useData("programs");
  const d = state.value;
  const [building, setBuilding] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [displayChat, setDisplayChat] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [refinement, setRefinement] = useState("");
  const [history, setHistory] = useState<Json[]>([]);
  const [draft, setDraft] = useState<Json | null>(null);
  const [volumeByPhase, setVolumeByPhase] = useState<Json[][] | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [intake, setIntake] = useState<BuilderIntake>({
    goal: "HYPERTROPHY",
    experience: "BEGINNER",
    daysPerWeek: 4,
    sessionMinutes: 60,
    equipment: ["DUMBBELL", "CABLE", "BODYWEIGHT"],
    priorityMuscles: [],
    injuries: "",
    notes: "",
  });

  useEffect(() => {
    if (building) window.scrollTo(0, 0);
  }, [building]);

  function update<K extends keyof BuilderIntake>(key: K, value: BuilderIntake[K]) {
    setIntake((current) => ({ ...current, [key]: value }));
  }
  function toggle(key: "equipment" | "priorityMuscles", value: string) {
    const values = intake[key];
    update(key, values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }
  async function runTurn(userMessage: string | null) {
    if (intake.equipment.length === 0) { setError("Choose at least one equipment type."); return; }
    setPending(true); setError("");
    try {
      const result = await post<Json>("/api/mobile/program-builder", {
        action: "turn", intake, history, userMessage,
      });
      if (!result.ok) { setError(result.error); return; }
      setDraft(result.draft); setHistory(result.history);
      setVolumeByPhase(result.volumeByPhase);
      setDisplayChat((current) => history.length > 0 && userMessage
        ? [...current, { role: "user", text: userMessage }, { role: "assistant", text: result.message }]
        : [{ role: "assistant", text: result.message }]);
      setRefinement("");
      window.setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to generate a program.");
    } finally { setPending(false); }
  }
  async function save(activate: boolean) {
    if (!draft) return;
    setPending(true); setError("");
    try {
      const result = await post<Json>("/api/mobile/program-builder", {
        action: "finalize", draft, activate, beginner: intake.experience === "BEGINNER",
      });
      if (!result.ok) { setError(result.error); return; }
      setBuilding(false); setDraft(null); setHistory([]); setDisplayChat([]); setVolumeByPhase(null);
      await state.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save the program.");
    } finally { setPending(false); }
  }
  async function activate(programId: string) {
    setSelectingId(programId); setError("");
    try {
      await post<Json>("/api/mobile/settings", { action: "activateProgram", programId });
      await state.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to activate the program.");
    } finally { setSelectingId(null); }
  }

  if (building) return <Screen title="Create program" eyebrow="AI program designer">
    {!d?.aiConsent ? <div className="panel builder-locked"><Bot size={24} /><h2>Enable AI coaching first</h2><p>Program generation sends your intake and exercise catalog to MiniMax. Review and enable consent in Settings before generating.</p><button className="button primary full" onClick={openSettings}>Open Settings</button><button className="button secondary full" onClick={() => setBuilding(false)}>Back to programs</button></div>
      : !d?.aiConfigured ? <div className="panel builder-locked"><Bot size={24} /><h2>AI service is not configured</h2><p>Add the MiniMax API key to the server environment before generating a program.</p><button className="button secondary full" onClick={() => setBuilding(false)}>Back to programs</button></div>
      : <>
        {!draft ? <div className="panel builder-form">
          <BuilderSelect label="Primary goal" value={intake.goal} options={BUILDER_GOALS} onChange={(value) => update("goal", value)} />
          <BuilderSelect label="Experience" value={intake.experience} options={BUILDER_EXPERIENCE} onChange={(value) => update("experience", value)} />
          <div className="builder-grid">
            <BuilderSelect label="Days per week" value={String(intake.daysPerWeek)} options={[2, 3, 4, 5, 6].map((value) => [String(value), `${value} days`] as const)} onChange={(value) => update("daysPerWeek", Number(value))} />
            <BuilderSelect label="Session length" value={String(intake.sessionMinutes)} options={[30, 45, 60, 75, 90].map((value) => [String(value), `${value} min`] as const)} onChange={(value) => update("sessionMinutes", Number(value))} />
          </div>
          <BuilderChips label="Equipment" values={BUILDER_EQUIPMENT} selected={intake.equipment} onToggle={(value) => toggle("equipment", value)} />
          <BuilderChips label="Priority muscles (optional)" values={BUILDER_MUSCLES} selected={intake.priorityMuscles} onToggle={(value) => toggle("priorityMuscles", value)} />
          <label className="builder-field">Injuries or limitations<input value={intake.injuries} maxLength={300} placeholder="e.g. avoid back squats" onChange={(event) => update("injuries", event.target.value)} /></label>
          <label className="builder-field">Anything else?<textarea value={intake.notes} maxLength={500} rows={3} placeholder="Preferences, schedule, or exercises you enjoy" onChange={(event) => update("notes", event.target.value)} /></label>
          {error && <p className="error">{error}</p>}
          <button className="button primary full" disabled={pending} onClick={() => void runTurn(null)}>{pending ? <><Loader2 className="spin" size={17} /> Designing your program...</> : <><Sparkles size={17} /> Generate program</>}</button>
          {pending && <BuilderThinking intake={intake} refining={false} />}
        </div> : <>
          <section className="panel builder-chat"><div className="coach-label"><Bot size={17} /><span>AI program coach</span></div><div className="chat-thread">{displayChat.map((turn, index) => <div className={`chat-turn ${turn.role}`} key={`${turn.role}-${index}`}><span>{turn.role === "assistant" ? "Coach" : "You"}</span><p>{turn.text}</p></div>)}<div ref={chatEndRef} /></div></section>
          <ProgramDraft draft={draft} volumeByPhase={volumeByPhase || [[], [], []]} beginner={intake.experience === "BEGINNER"} />
          <div className="panel builder-refine"><label className="builder-field">Refine this program<textarea value={refinement} rows={3} maxLength={2000} placeholder="e.g. replace lunges and add more back work" onChange={(event) => setRefinement(event.target.value)} /></label><button className="button secondary full" disabled={pending || !refinement.trim()} onClick={() => void runTurn(refinement.trim())}>{pending ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />} Apply changes</button>{pending && <BuilderThinking intake={intake} refining />}</div>
          {error && <p className="error">{error}</p>}
          <div className="builder-actions"><button className="button primary full" disabled={pending} onClick={() => void save(true)}><Check size={17} /> Save and activate</button><button className="button secondary full" disabled={pending} onClick={() => void save(false)}>Save only</button><button className="text-button" disabled={pending} onClick={() => { setDraft(null); setHistory([]); setDisplayChat([]); setVolumeByPhase(null); }}>Start over</button></div>
        </>}
      </>}
  </Screen>;

  return <Screen title="Programs" eyebrow="Training structure">
    <AsyncState loading={state.loading} error={state.error} />
    {d && <button className="panel create-program" onClick={() => setBuilding(true)}><span><Sparkles size={18} /><strong>Create with AI</strong><small>Design, review, and activate a personalized program.</small></span><ChevronRight size={19} /></button>}
    {error && <div className="panel error-panel">{error}</div>}
    {d?.programs.map((program: Json) => {
      const active = program.id === d.activeProgramId;
      const selecting = selectingId === program.id;
      return <section className={active ? "panel program active-program" : "panel program"} key={program.id}>
        <span className="kicker">{active ? "ACTIVE PROGRAM" : "PROGRAM"}</span>
        <h2>{program.name}</h2><p>{program.description}</p>
        {program.workouts.map((workout: Json) => <div className="program-day" key={workout.id}><strong>{workout.name}</strong><span>{workout.exercises.length} exercises</span></div>)}
        <div className="program-actions">
          {active
            ? <div className="program-selected"><Check size={16} /><span>Selected for training</span></div>
            : <button className="button secondary full" disabled={selectingId !== null} onClick={() => void activate(program.id)}>{selecting ? <Loader2 className="spin" size={16} /> : <Check size={16} />}{selecting ? "Activating..." : "Use this program"}</button>}
        </div>
      </section>;
    })}
  </Screen>;
}

function BuilderSelect({ label, value, options, onChange }: { label: string; value: string; options: ReadonlyArray<readonly [string, string]>; onChange: (value: string) => void }) {
  return <label className="builder-field">{label}<select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}</select></label>;
}
function BuilderChips({ label, values, selected, onToggle }: { label: string; values: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return <fieldset className="builder-field"><legend>{label}</legend><div className="chip-group">{values.map((value) => <button type="button" key={value} className={selected.includes(value) ? "chip active" : "chip"} onClick={() => onToggle(value)}>{pretty(value)}</button>)}</div></fieldset>;
}

function builderThinkingSteps(intake: BuilderIntake, refining: boolean) {
  if (refining) return ["Re-reading the current program...", "Applying your change...", "Re-balancing weekly volume...", "Checking the full 13-week progression..."];
  const goal = BUILDER_GOALS.find(([value]) => value === intake.goal)?.[1].toLowerCase() || "your goal";
  const steps = [
    `Reading your intake: ${goal}, ${intake.daysPerWeek} days/week, ${intake.sessionMinutes}-minute sessions...`,
    `Choosing a ${intake.daysPerWeek}-day training split...`,
  ];
  if (intake.priorityMuscles.length) steps.push(`Prioritizing ${intake.priorityMuscles.map(pretty).join(", ")}...`);
  if (intake.injuries.trim()) steps.push("Working around the limitations you listed...");
  steps.push(
    `Selecting movements for ${intake.equipment.map(pretty).join(", ")}...`,
    "Balancing direct and secondary weekly sets...",
    "Setting rep ranges, effort targets, and rest periods...",
    "Building three progression phases and the deload...",
    "Writing the program overview...",
  );
  return steps;
}

function BuilderThinking({ intake, refining }: { intake: BuilderIntake; refining: boolean }) {
  const [steps] = useState(() => builderThinkingSteps(intake, refining));
  const [index, setIndex] = useState(0);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const progress = window.setInterval(() => setIndex((current) => Math.min(current + 1, steps.length - 1)), refining ? 4000 : 3200);
    const clock = window.setInterval(() => setSeconds((current) => current + 1), 1000);
    return () => { window.clearInterval(progress); window.clearInterval(clock); };
  }, [refining, steps.length]);
  return <div className="builder-thinking" aria-live="polite">
    <div className="thinking-head"><Bot size={17} /><strong>{refining ? "Updating your program" : "Designing your program"}</strong><span>{seconds}s</span></div>
    {steps.slice(0, index + 1).map((step, stepIndex) => <div className={stepIndex < index ? "thinking-step complete" : "thinking-step"} key={step}><span>{stepIndex < index ? <Check size={15} /> : <Loader2 className="spin" size={15} />}</span><p>{step}</p></div>)}
    {index === steps.length - 1 && seconds > (refining ? 25 : 40) && <small>Still working. Detailed programs can take a minute or two.</small>}
  </div>;
}

const DRAFT_PHASES = ["Overview", "Weeks 1-4", "Weeks 5-8", "Weeks 9-12", "Week 13"] as const;
const PHASE_DETAILS = [
  { name: "Foundation", objective: "Groove technique and establish the base volume.", expect: "Progress weight and reps while you own each range." },
  { name: "Build", objective: "Add volume to priority lifts after recovery is established.", expect: "Selected exercises gain a set and sessions run slightly longer." },
  { name: "Specialize", objective: "Peak priority-muscle volume before the deload.", expect: "The hardest weeks of the cycle, followed by planned recovery." },
] as const;

function resolvedDraftSets(draft: Json, dayIndex: number, slot: Json, phase: number | "deload") {
  if (phase === "deload") return Math.ceil(slot.sets / 2);
  if (phase === 2) return slot.sets + (draft.block2AddSets?.some((item: Json) => item.day === dayIndex + 1 && item.exercise === slot.exercise) ? 1 : 0);
  if (phase === 3) return slot.sets + (draft.block3AddSets?.find((item: Json) => item.day === dayIndex + 1 && item.exercise === slot.exercise)?.addSets || 0);
  return slot.sets;
}
function draftWeeklySets(draft: Json, phase: number | "deload") {
  return draft.days?.reduce((total: number, day: Json, dayIndex: number) => total + day.slots.reduce((sum: number, slot: Json) => sum + resolvedDraftSets(draft, dayIndex, slot, phase), 0), 0) || 0;
}

function ProgramDraft({ draft, volumeByPhase, beginner }: { draft: Json; volumeByPhase: Json[][]; beginner: boolean }) {
  const [tab, setTab] = useState(0);
  const phase = tab === 0 ? null : tab === 4 ? "deload" : tab;
  const effort = beginner ? "2-3 reps in reserve on compounds, 1-2 on isolation" : "1-2 reps in reserve on compounds, 0-1 on isolation";
  const changes = [
    "Baseline sets on every exercise.",
    draft.block2AddSets?.length ? `+1 set on ${draft.block2AddSets.length} priority exercise${draft.block2AddSets.length === 1 ? "" : "s"}.` : "Progress through weight and reps.",
    draft.block3AddSets?.length ? `Peak volume adds ${draft.block3AddSets.reduce((sum: number, item: Json) => sum + item.addSets, 0)} sets/week across ${draft.block3AddSets.length} exercises.` : "Progress through weight and reps.",
  ];
  return <section className="panel draft-program">
    <span className="kicker">PROGRAM DRAFT</span><h2>{draft.name}</h2><p>{draft.description}</p>
    <div className="phase-tabs" role="tablist">{DRAFT_PHASES.map((label, index) => <button role="tab" aria-selected={tab === index} className={tab === index ? "active" : ""} onClick={() => setTab(index)} key={label}>{label}</button>)}</div>
    {phase === null ? <div className="phase-overview">
      {PHASE_DETAILS.map((detail, index) => <article className="phase-summary" key={detail.name}><span>Phase {index + 1} · Weeks {index * 4 + 1}-{index * 4 + 4}</span><h3>{detail.name}</h3><p>{detail.objective}</p><small>{detail.expect}</small><div><strong>{draft.days.length} sessions/wk</strong><strong>{draftWeeklySets(draft, index + 1)} weekly sets</strong></div><small>{changes[index]}</small></article>)}
      <div className="phase-guidance"><p><strong>Effort:</strong> {effort}</p><p><strong>Rest:</strong> 2-3 min compounds, 60-90s isolation.</p><p>Week 13 halves the sets at about 82% of working weight, then the next cycle begins.</p></div>
    </div> : <div className="phase-detail">
      <div className="phase-intro">{phase === "deload" ? <><strong>Deload.</strong> Half the sets at about 82% of working weights.</> : <><strong>{PHASE_DETAILS[phase - 1].name}.</strong> {PHASE_DETAILS[phase - 1].objective}</>}</div>
      {draft.days?.map((day: Json, dayIndex: number) => <div className="draft-day" key={`${day.name}-${dayIndex}`}><div><span><small>Day {dayIndex + 1}</small><strong>{day.name}</strong></span><span>{day.focus}</span></div>{day.slots?.map((slot: Json) => { const sets = resolvedDraftSets(draft, dayIndex, slot, phase); return <div className="draft-slot" key={slot.exercise}><span>{slot.exercise}{slot.newExercise && <em>new</em>}</span><small className={sets !== slot.sets && phase !== "deload" ? "changed" : ""}>{sets} × {slot.repMin}-{slot.repMax}{slot.isPerSide ? " each" : ""}{sets > slot.sets ? ` (+${sets - slot.sets})` : ""}</small></div>; })}</div>)}
      {phase !== "deload" && <div className="volume-summary"><h3>Weekly sets per muscle</h3>{(volumeByPhase[phase - 1] || []).map((row: Json) => <div key={row.muscle}><span>{pretty(row.muscle)}</span><strong>{row.directSets}{row.indirectSets > 0 ? ` +${row.indirectSets}` : ""}</strong></div>)}<small>Direct sets, with secondary-muscle sets after the +.</small></div>}
    </div>}
  </section>;
}

function PhotosScreen() {
  const state = useData("photos"); const [angle, setAngle] = useState<"front" | "side" | "back">("front"); const [pending, setPending] = useState(false); const [message, setMessage] = useState("");
  async function capture() {
    setPending(true); setMessage("");
    try {
      const photo = await Camera.getPhoto({ source: CameraSource.Prompt, resultType: CameraResultType.Uri, quality: 90 });
      if (!photo.webPath) return;
      const image = await fetch(photo.webPath); const file = await image.blob(); const form = new FormData();
      form.set("date", new Date().toLocaleDateString("en-CA")); form.set(angle, new File([file], `${angle}.${photo.format}`, { type: file.type || `image/${photo.format}` }));
      await upload("/api/photos", form); setMessage("Photo saved."); await state.reload();
    } catch (reason) { if (reason instanceof Error && !reason.message.toLowerCase().includes("cancel")) setMessage(reason.message); }
    finally { setPending(false); }
  }
  const photos = (state.value?.groups || []).flatMap((group: Json) => group.entries || []).flatMap((entry: Json) => Object.values(entry.photos || {}).filter(Boolean));
  return <Screen title="Progress photos" eyebrow={`${state.value?.totalPhotos ?? 0} photos`}><AsyncState loading={state.loading} error={state.error} /><div className="panel capture-panel"><div className="segments">{(["front", "side", "back"] as const).map((item) => <button key={item} className={angle === item ? "active" : ""} onClick={() => setAngle(item)}>{pretty(item)}</button>)}</div><button className="button primary full" onClick={capture} disabled={pending}>{pending ? "Saving..." : "Take or choose photo"}</button>{message && <p className="notice">{message}</p>}</div><div className="photo-grid">{photos.slice(0, 12).map((photo: Json) => <PhotoThumb key={photo.id} photo={photo} />)}</div></Screen>;
}

function PhotoThumb({ photo }: { photo: Json }) { const [src, setSrc] = useState(""); useEffect(() => { let url = ""; void authorizedBlob(`/api/photos/${photo.id}`).then((blob) => { url = URL.createObjectURL(blob); setSrc(url); }); return () => { if (url) URL.revokeObjectURL(url); }; }, [photo.id]); return <div className="photo-thumb">{src ? <img src={src} alt={`${pretty(photo.angle || "progress")} progress`} /> : <Loader2 className="spin" size={18} />}<span>{pretty(photo.angle || "photo")}</span></div>; }

function SettingsScreen({ user, onSignedOut }: { user: User; onSignedOut: () => void }) {
  const state = useData("settings"); const d = state.value; const [deleteOpen, setDeleteOpen] = useState(false); const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [message, setMessage] = useState("");
  async function setConsent(enabled: boolean) { await post("/api/mobile/settings", { action: "aiConsent", enabled }); await state.reload(); }
  async function enablePush() {
    if (!Capacitor.isNativePlatform()) return;
    const permission = await PushNotifications.requestPermissions(); if (permission.receive !== "granted") { setMessage("Notification permission was not granted."); return; }
    const handle = await PushNotifications.addListener("registration", async (registration) => { await request("/api/push/register", { method: "POST", body: JSON.stringify({ token: registration.value, platform: "ios" }) }); setMessage("Notifications enabled."); await handle.remove(); });
    await PushNotifications.register();
  }
  async function remove() { await request("/api/auth/delete-user", { method: "POST", body: JSON.stringify({ password }) }); await saveToken(null); onSignedOut(); }
  return <Screen title="Settings" eyebrow={user.username || user.name}><AsyncState loading={state.loading} error={state.error} />{d && <>
    <section className="panel settings-section"><h2>Connected services</h2><SettingRow label="WHOOP" value={d.whoop.connected ? "Connected" : "Not connected"} /><SettingRow label="Google Health" value={d.fitbit.connected ? "Connected" : "Not connected"} /></section>
    <section className="panel settings-section"><h2>Permissions</h2><SettingToggle label="AI coaching" description="Send workout and connected recovery or sleep context to MiniMax for personalized coaching." checked={d.settings?.aiDataSharingEnabled === true} onChange={setConsent} /><button className="settings-command" onClick={enablePush}><span><strong>Push notifications</strong><small>Briefs, streak reminders, records, and reconnect alerts.</small></span><ChevronRight size={18} /></button>{message && <p className="notice">{message}</p>}</section>
    <section className="panel settings-section"><h2>Privacy and account</h2><button className="settings-command" onClick={() => window.open(`${API_URL}/privacy`, "_blank")}><span><strong>Privacy Policy</strong><small>Data use, retention, providers, and your choices.</small></span><Shield size={18} /></button>{!deleteOpen ? <button className="settings-command danger" onClick={() => setDeleteOpen(true)}><span><strong>Delete account</strong><small>Permanently remove your account and all stored data.</small></span><ChevronRight size={18} /></button> : <div className="delete-form"><strong>This cannot be undone</strong><p>Workouts, measurements, photos, wearable connections, tokens, and credentials will be deleted.</p><input type="password" placeholder="Confirm password" value={password} onChange={(e) => setPassword(e.target.value)} /><input placeholder="Type DELETE" value={confirm} onChange={(e) => setConfirm(e.target.value)} /><button className="button danger full" disabled={!password || confirm !== "DELETE"} onClick={remove}>Permanently delete account</button><button className="button secondary full" onClick={() => setDeleteOpen(false)}>Cancel</button></div>}</section>
    <button className="button secondary full" onClick={async () => { await signOut(); onSignedOut(); }}><LogOut size={17} /> Sign out</button>
  </>}</Screen>;
}

function SettingRow({ label, value }: { label: string; value: string }) { return <div className="setting-row"><strong>{label}</strong><span>{value}</span></div>; }
function SettingToggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => Promise<void> }) { return <div className="setting-row"><span><strong>{label}</strong><small>{description}</small></span><button role="switch" aria-checked={checked} className={checked ? "switch on" : "switch"} onClick={() => void onChange(!checked)}><span /></button></div>; }
function DataSummary({ value }: { value: Json }) { const entries = Object.entries(value).filter(([, x]) => Array.isArray(x) && x.length > 0).slice(0, 4); return <>{entries.map(([key, rows]) => <section key={key}><h2 className="section-title">{pretty(key)}</h2><div className="panel data-strip">{(rows as Json[]).slice(-8).map((row, index) => <div key={row.id || row.date || index}><strong>{row.label || row.date || row.name || index + 1}</strong><small>{summarize(row)}</small></div>)}</div></section>)}</>; }
function summarize(row: Json) { const values = Object.entries(row).filter(([key, value]) => key !== "label" && key !== "date" && ["string", "number"].includes(typeof value)).slice(0, 2); return values.map(([key, value]) => `${pretty(key)} ${value}`).join(" · "); }
function pretty(value: string) { return value.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/^./, (c) => c.toUpperCase()); }
function Centered({ children }: { children: React.ReactNode }) { return <div className="centered">{children}</div>; }
