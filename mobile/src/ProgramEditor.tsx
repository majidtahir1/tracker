import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Loader2, Plus, Trash2, X } from "lucide-react";
import { data, post } from "./api";

/**
 * Manual program builder — build a DraftProgram locally (name, days, catalog
 * exercises with sets and rep ranges) and persist it in one shot through the
 * existing /api/mobile/program-builder "finalize" action, the same endpoint
 * the AI builder uses. No AI consent or MiniMax key required: finalize is a
 * pure "write this program" transaction.
 */

type Json = Record<string, any>;

interface SlotDraft {
  exercise: string; // catalog exercise name — finalize resolves by name
  sets: number;
  repMin: number;
  repMax: number;
}
interface DayDraft {
  name: string;
  slots: SlotDraft[];
}

export default function ProgramEditor({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const [catalog, setCatalog] = useState<Json[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [days, setDays] = useState<DayDraft[]>([{ name: "Day 1", slots: [] }]);
  const [pickerDay, setPickerDay] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void data<Json[]>("exercises")
      .then(setCatalog)
      .catch((reason) => setCatalogError(reason instanceof Error ? reason.message : "Unable to load exercises"));
  }, []);

  const pickerList = useMemo(() => {
    const q = search.toLowerCase();
    const chosen = pickerDay == null ? new Set<string>() : new Set(days[pickerDay]?.slots.map((s) => s.exercise));
    return catalog.filter((ex) => !chosen.has(ex.name) && ex.name.toLowerCase().includes(q));
  }, [catalog, search, pickerDay, days]);

  function updateDay(index: number, update: Partial<DayDraft>) {
    setDays((current) => current.map((day, i) => (i === index ? { ...day, ...update } : day)));
  }
  function updateSlot(dayIndex: number, slotIndex: number, update: Partial<SlotDraft>) {
    setDays((current) => current.map((day, i) => i === dayIndex
      ? { ...day, slots: day.slots.map((slot, j) => (j === slotIndex ? { ...slot, ...update } : slot)) }
      : day));
  }
  function addDay() {
    setDays((current) => [...current, { name: `Day ${current.length + 1}`, slots: [] }]);
  }
  function removeDay(index: number) {
    setDays((current) => current.filter((_, i) => i !== index));
  }
  function addExercise(dayIndex: number, exercise: string) {
    // Same defaults the web manual editor applies (addProgramExercise): 3 × 8–12.
    setDays((current) => current.map((day, i) => i === dayIndex
      ? { ...day, slots: [...day.slots, { exercise, sets: 3, repMin: 8, repMax: 12 }] }
      : day));
    setPickerDay(null);
    setSearch("");
  }
  function removeSlot(dayIndex: number, slotIndex: number) {
    setDays((current) => current.map((day, i) => i === dayIndex
      ? { ...day, slots: day.slots.filter((_, j) => j !== slotIndex) }
      : day));
  }

  function validate(): string | null {
    if (name.trim().length < 2) return "Give the program a name (at least 2 characters).";
    if (days.length === 0) return "Add at least one training day.";
    for (const day of days) {
      if (day.name.trim().length < 2) return "Every day needs a name.";
      if (day.slots.length === 0) return `Add at least one exercise to ${day.name.trim() || "each day"}.`;
      for (const slot of day.slots) {
        if (!Number.isInteger(slot.sets) || slot.sets < 1 || slot.sets > 10) return `${slot.exercise}: sets must be 1-10.`;
        if (!Number.isInteger(slot.repMin) || !Number.isInteger(slot.repMax) || slot.repMin < 1 || slot.repMax < slot.repMin) {
          return `${slot.exercise}: check the rep range.`;
        }
      }
    }
    return null;
  }

  async function save(activate: boolean) {
    const problem = validate();
    if (problem) { setError(problem); return; }
    setPending(true); setError("");
    try {
      const draft = {
        name: name.trim(),
        description: description.trim(),
        days: days.map((day) => ({
          name: day.name.trim(),
          focus: "",
          slots: day.slots.map((slot) => ({
            exercise: slot.exercise,
            sets: slot.sets,
            repMin: slot.repMin,
            repMax: slot.repMax,
            priority: "NORMAL",
            isPerSide: false,
            notes: null,
            newExercise: null, // catalog-only picks — nothing to create
          })),
        })),
        block2AddSets: [],
        block3AddSets: [],
      };
      const result = await post<Json>("/api/mobile/program-builder", { action: "finalize", draft, activate, beginner: false });
      if (!result.ok) { setError(result.error || "Saving the program failed."); return; }
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Saving the program failed.");
    } finally { setPending(false); }
  }

  return <div className="screen">
    <button className="text-button editor-back" onClick={onClose}><ArrowLeft size={15} /> Back to programs</button>
    <p className="eyebrow">Build your own</p>
    <h1>Create program</h1>

    <div className="panel builder-form">
      <label className="builder-field">Program name<input value={name} maxLength={60} placeholder="e.g. Push / Pull / Legs" onChange={(e) => setName(e.target.value)} /></label>
      <label className="builder-field">Description (optional)<input value={description} maxLength={200} placeholder="What is this program for?" onChange={(e) => setDescription(e.target.value)} /></label>
    </div>

    {days.map((day, dayIndex) => (
      <section className="panel editor-day" key={dayIndex}>
        <div className="editor-day-head">
          <label className="builder-field">Day {dayIndex + 1}<input value={day.name} maxLength={60} onChange={(e) => updateDay(dayIndex, { name: e.target.value })} /></label>
          {days.length > 1 && <button className="icon-button" aria-label={`Remove ${day.name}`} onClick={() => removeDay(dayIndex)}><Trash2 size={17} /></button>}
        </div>
        {day.slots.map((slot, slotIndex) => (
          <div className="editor-slot" key={`${slot.exercise}-${slotIndex}`}>
            <div className="editor-slot-name"><strong>{slot.exercise}</strong><button className="icon-button" aria-label={`Remove ${slot.exercise}`} onClick={() => removeSlot(dayIndex, slotIndex)}><X size={15} /></button></div>
            <div className="editor-slot-targets">
              <label>Sets<input inputMode="numeric" value={slot.sets} onChange={(e) => updateSlot(dayIndex, slotIndex, { sets: Number(e.target.value) })} /></label>
              <label>Reps min<input inputMode="numeric" value={slot.repMin} onChange={(e) => updateSlot(dayIndex, slotIndex, { repMin: Number(e.target.value) })} /></label>
              <label>Reps max<input inputMode="numeric" value={slot.repMax} onChange={(e) => updateSlot(dayIndex, slotIndex, { repMax: Number(e.target.value) })} /></label>
            </div>
          </div>
        ))}
        <button className="button secondary full" onClick={() => { setPickerDay(dayIndex); setSearch(""); }}><Plus size={16} /> Add exercise</button>
      </section>
    ))}

    <button className="button secondary full editor-add-day" onClick={addDay}><Plus size={16} /> Add training day</button>

    {error && <p className="error">{error}</p>}
    {catalogError && <p className="error">{catalogError}</p>}

    <div className="builder-actions">
      <button className="button primary full" disabled={pending} onClick={() => void save(true)}>{pending ? <Loader2 className="spin" size={16} /> : <Check size={16} />} Save and activate</button>
      <button className="button secondary full" disabled={pending} onClick={() => void save(false)}>Save only</button>
    </div>

    {pickerDay != null && (
      <div className="sheet-backdrop" onClick={() => setPickerDay(null)}>
        <div className="sheet picker-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="sheet-head"><strong>Add to {days[pickerDay]?.name}</strong><button className="icon-button" onClick={() => setPickerDay(null)}><X size={18} /></button></div>
          <input className="search" placeholder="Search exercises" value={search} autoFocus onChange={(e) => setSearch(e.target.value)} />
          <div className="picker-list">
            {pickerList.map((ex) => (
              <button className="picker-row" key={ex.id} onClick={() => addExercise(pickerDay, ex.name)}>
                <span><strong>{ex.name}</strong><small>{pretty(ex.primaryMuscle)} · {pretty(ex.equipment)}</small></span>
                <Plus size={16} />
              </button>
            ))}
            {pickerList.length === 0 && <p className="empty">No matching exercises.</p>}
          </div>
        </div>
      </div>
    )}
  </div>;
}

function pretty(value: string) { return value.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()); }
