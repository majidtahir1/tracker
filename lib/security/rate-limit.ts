import { prisma } from "@/lib/db";

export class RateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(`Too many requests. Try again in ${retryAfterSeconds} seconds.`);
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Persistent fixed-window limiter, shared by every app instance. */
export async function enforceRateLimit(
  userId: string,
  action: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(nowSeconds / windowSeconds) * windowSeconds;
  const row = await prisma.actionRateLimit.upsert({
    where: { userId_action_windowStart: { userId, action, windowStart } },
    create: { userId, action, windowStart, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });

  if (row.count > limit) {
    throw new RateLimitError(Math.max(1, windowStart + windowSeconds - nowSeconds));
  }

  // Opportunistic cleanup keeps the table bounded without a separate cron job.
  if (Math.random() < 0.01) {
    void prisma.actionRateLimit
      .deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      })
      .catch(() => {});
  }
}
