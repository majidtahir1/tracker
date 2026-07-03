/**
 * lib/whoop/match.ts — pure time-overlap matching between a logged
 * WorkoutSession and the WHOOP-detected activity covering it. Derived at
 * read time (never stored): WHOOP often syncs hours after the session is
 * logged, so a stored link would go stale.
 */

export interface WhoopMatchCandidate {
  start: Date;
  end: Date;
}

/** Overlap between [aStart, aEnd] and [bStart, bEnd] in ms (0 when disjoint). */
export function overlapMs(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  return Math.max(
    0,
    Math.min(aEnd.getTime(), bEnd.getTime()) - Math.max(aStart.getTime(), bStart.getTime()),
  );
}

const MIN_OVERLAP_MS = 5 * 60 * 1000;

/**
 * Best WHOOP activity for a session: largest time overlap, requiring at
 * least 5 minutes AND half of the shorter of the two durations — enough to
 * reject a brief warm-up walk without dropping short sessions.
 */
export function matchWhoopWorkout<W extends WhoopMatchCandidate>(
  startedAt: Date | null,
  completedAt: Date | null,
  candidates: W[],
): W | null {
  if (!startedAt || !completedAt) return null;
  const sessionMs = completedAt.getTime() - startedAt.getTime();
  if (sessionMs <= 0) return null;

  let best: W | null = null;
  let bestOverlap = 0;
  for (const w of candidates) {
    const overlap = overlapMs(startedAt, completedAt, w.start, w.end);
    const shorterMs = Math.min(sessionMs, w.end.getTime() - w.start.getTime());
    if (overlap < Math.max(MIN_OVERLAP_MS, shorterMs / 2)) continue;
    if (overlap > bestOverlap) {
      best = w;
      bestOverlap = overlap;
    }
  }
  return best;
}
