/** Private storage location + MIME/path helpers for progress photos. */
import path from "node:path";

/** Absolute directory where progress-photo files are stored (outside public/). */
export function photosDir(): string {
  return process.env.PHOTOS_DIR ?? path.join(process.cwd(), "var", "photos");
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
};

/** MIME type from a filename's extension; octet-stream for unknown. */
export function contentTypeForFilename(name: string): string {
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

/**
 * Absolute path for a bare photo filename under photosDir(), or null if the
 * name is unsafe. A bare filename cannot escape the dir, so rejecting path
 * separators, "..", and NUL is sufficient.
 */
export function resolveSafe(filename: string): string | null {
  if (
    !filename ||
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("\0") ||
    filename.includes("..")
  ) {
    return null;
  }
  return path.join(photosDir(), filename);
}
