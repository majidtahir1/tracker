"use client";

/**
 * Progress-photo uploader — front/side/back picker tiles with live previews,
 * date/weight/body-fat/notes, multipart POST to /api/photos.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Plus, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldError, Input, Label, Textarea } from "@/components/ui/Input";

const ANGLES = [
  { key: "front", label: "Front" },
  { key: "side", label: "Side" },
  { key: "back", label: "Back" },
] as const;

type AngleKey = (typeof ANGLES)[number]["key"];

function AngleTile({
  label,
  file,
  onSelect,
}: {
  label: string;
  file: File | null;
  onSelect: (file: File | null) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <label className="relative block cursor-pointer">
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        className="sr-only"
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
      />
      <span
        className={`flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-sm border transition-colors ${
          preview
            ? "border-accent-border"
            : "border-dashed border-border hover:border-border-strong"
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={`${label} preview`} className="h-full w-full object-cover" />
        ) : (
          <>
            <Camera className="size-6 text-text-faint" strokeWidth={2} />
            <span className="text-xs font-medium text-text-3">{label}</span>
          </>
        )}
      </span>
      {preview && (
        <span className="absolute left-1.5 top-1.5 rounded-xs bg-bg/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-2">
          {label}
        </span>
      )}
    </label>
  );
}

export default function PhotoUploadForm({ defaultDate }: { defaultDate: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<Record<AngleKey, File | null>>({
    front: null,
    side: null,
    back: null,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const anyFile = ANGLES.some(({ key }) => files[key] != null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!anyFile) {
      setError("Attach at least one photo.");
      return;
    }
    const form = e.currentTarget;
    const body = new FormData(form);
    for (const { key } of ANGLES) {
      body.delete(key);
      const f = files[key];
      if (f) body.append(key, f);
    }

    setPending(true);
    try {
      const res = await fetch("/api/photos", { method: "POST", body });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(json?.error ?? "Upload failed — try again.");
        return;
      }
      setFiles({ front: null, side: null, back: null });
      formRef.current?.reset();
      setOpen(false);
      setSaved(true);
      router.refresh();
    } catch {
      setError("Upload failed — check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" strokeWidth={2} />
          Add photos
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <Check className="size-3.5" strokeWidth={2} /> Uploaded
          </span>
        )}
      </div>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border-faint px-5 py-4">
        <h2 className="text-sm font-semibold text-text">Add progress photos</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close form"
          className="rounded-sm p-1 text-text-3 transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      </div>
      <form ref={formRef} onSubmit={handleSubmit} className="p-5">
        <div className="grid max-w-md grid-cols-3 gap-2">
          {ANGLES.map(({ key, label }) => (
            <AngleTile
              key={key}
              label={label}
              file={files[key]}
              onSelect={(f) => setFiles((prev) => ({ ...prev, [key]: f }))}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-text-3">
          Same lighting, same spot, same time of day. Tap a tile to pick or retake.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="p-date">Date</Label>
            <Input id="p-date" name="date" type="date" defaultValue={defaultDate} required />
          </div>
          <div>
            <Label htmlFor="p-weight">
              Weight <span className="text-text-faint">(lb)</span>
            </Label>
            <Input id="p-weight" name="weight" numeric placeholder="185.0" autoComplete="off" />
          </div>
          <div>
            <Label htmlFor="p-bodyfat">
              Body fat <span className="text-text-faint">(%)</span>
            </Label>
            <Input id="p-bodyfat" name="bodyFat" numeric placeholder="15.0" autoComplete="off" />
          </div>
        </div>

        <div className="mt-4">
          <Label htmlFor="p-notes">Notes</Label>
          <Textarea id="p-notes" name="notes" placeholder="End of Block 1 — pump day…" />
        </div>

        {error && <FieldError>{error}</FieldError>}

        <div className="mt-5 flex gap-3">
          <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending || !anyFile}>
            {pending ? "Uploading…" : "Upload photos"}
          </Button>
          <Button type="button" variant="ghost" size="lg" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
