/**
 * lib/onboarding.ts — first-run wizard gating and validation (pure; see
 * docs/superpowers/specs/2026-07-11-onboarding-wizard-design.md).
 */

/**
 * Show the wizard only to accounts that have neither finished it nor actually
 * trained. The completed-session check exempts pre-feature accounts without a
 * backfill, and re-prompts a brand-new user who quit mid-wizard.
 */
export function shouldOnboard(
  settings: { onboardedAt: string | null } | null,
  completedSessionCount: number,
): boolean {
  if (completedSessionCount > 0) return false;
  return settings?.onboardedAt == null;
}

/** Body weight in lb, or null when the step was skipped. */
export function validBodyWeightLb(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 30 && value <= 1000;
}
