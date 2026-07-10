/**
 * GET /api/photos/[id] — authenticated, ownership-checked progress-photo bytes.
 * 401 without a session; 404 for not-found / not-owned / missing file / unsafe
 * name (identical 404 so existence isn't leaked). Files live under PHOTOS_DIR.
 */
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { contentTypeForFilename, resolveSafe } from "@/lib/photos-storage";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const photo = await prisma.progressPhoto.findUnique({ where: { id } });
  if (!photo || photo.userId !== session.user.id) {
    return new NextResponse(null, { status: 404 });
  }

  const abs = resolveSafe(photo.filePath);
  if (!abs) return new NextResponse(null, { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await readFile(abs);
  } catch {
    return new NextResponse(null, { status: 404 });
  }

  // Buffer's ArrayBufferLike generic isn't assignable to BodyInit's
  // ArrayBuffer-only Uint8Array under the current @types/node + dom lib
  // combo; copy into a plain ArrayBuffer-backed view.
  const body = new Uint8Array(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  );

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentTypeForFilename(photo.filePath),
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
