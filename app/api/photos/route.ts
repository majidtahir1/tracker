/**
 * POST /api/photos — multipart progress-photo upload (the single non-server-
 * action mutation, per ARCHITECTURE.md). Streams files to public/photos/ and
 * upserts ProgressPhoto rows (one per angle; @@unique([userId, date, angle])).
 *
 * Form fields: date (YYYY-MM-DD, required), weight?, bodyFat?, notes?,
 * and up to three files under keys "front" | "side" | "back".
 */
import { NextResponse } from "next/server";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB per image

const ANGLES = [
  { field: "front", angle: "FRONT" },
  { field: "side", angle: "SIDE" },
  { field: "back", angle: "BACK" },
] as const;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

function optionalNumber(raw: FormDataEntryValue | null): number | null | undefined {
  const s = String(raw ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const date = String(form.get("date") ?? "").trim();
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "Pick a valid date." }, { status: 400 });
  }

  const weight = optionalNumber(form.get("weight"));
  const bodyFat = optionalNumber(form.get("bodyFat"));
  if (weight === undefined || bodyFat === undefined) {
    return NextResponse.json({ error: "Weight and body fat must be numbers." }, { status: 400 });
  }
  const notesRaw = String(form.get("notes") ?? "").trim();
  const notes = notesRaw === "" ? null : notesRaw.slice(0, 1000);

  const files: Array<{ angle: (typeof ANGLES)[number]["angle"]; file: File; ext: string }> = [];
  for (const { field, angle } of ANGLES) {
    const value = form.get(field);
    if (!(value instanceof File) || value.size === 0) continue;
    const ext = EXT_BY_MIME[value.type];
    if (!ext) {
      return NextResponse.json(
        { error: `Unsupported image type for ${field} (use JPG, PNG, WebP, or HEIC).` },
        { status: 400 },
      );
    }
    if (value.size > MAX_BYTES) {
      return NextResponse.json({ error: `${field} photo is over 15 MB.` }, { status: 400 });
    }
    files.push({ angle, file: value, ext });
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "Attach at least one photo." }, { status: 400 });
  }

  const photosDir = path.join(process.cwd(), "public", "photos");
  await mkdir(photosDir, { recursive: true });

  const saved: Array<{ id: string; angle: string; filePath: string }> = [];
  for (const { angle, file, ext } of files) {
    const name = `${date}-${angle.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const filePath = `/photos/${name}`;
    await writeFile(path.join(photosDir, name), Buffer.from(await file.arrayBuffer()));

    // Replacing the same user+date+angle: keep the unique row, remove the old file.
    const existing = await prisma.progressPhoto.findUnique({
      where: { userId_date_angle: { userId, date, angle } },
    });

    const row = await prisma.progressPhoto.upsert({
      where: { userId_date_angle: { userId, date, angle } },
      update: { filePath, weight, bodyFat, notes },
      create: { userId, date, angle, filePath, weight, bodyFat, notes },
    });

    if (existing && existing.filePath !== filePath) {
      const old = path.resolve(path.join(process.cwd(), "public", existing.filePath));
      if (old.startsWith(photosDir + path.sep)) {
        try {
          await unlink(old);
        } catch {
          // already gone
        }
      }
    }

    saved.push({ id: row.id, angle, filePath });
  }

  revalidatePath("/photos");
  return NextResponse.json({ ok: true, saved }, { status: 201 });
}
