/**
 * First-login provisioning: every new user gets an AppSettings row and a
 * TrainingBlock cycle 1 so the dashboard/workout pages work immediately.
 * Called from the Better Auth user.create.after database hook.
 */
import { prisma } from "@/lib/db";

/** YYYY-MM-DD of the Monday of `now`'s week (Mon-start weeks). */
export function mondayOfCurrentWeek(now: Date): string {
  const d = new Date(now);
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export async function provisionNewUser(userId: string): Promise<void> {
  const firstProgram = await prisma.program.findFirst({ orderBy: { createdAt: "asc" } });
  await prisma.$transaction([
    prisma.appSettings.upsert({
      where: { userId },
      update: {},
      // Explicit id: the schema default is still "singleton" until Task 11's
      // phase-2 migration switches it to cuid(); without this the SECOND user's
      // create would collide with the owner's row.
      create: { id: crypto.randomUUID(), userId, activeProgramId: firstProgram?.id ?? null },
    }),
    prisma.trainingBlock.upsert({
      where: { userId_cycleNumber: { userId, cycleNumber: 1 } },
      update: {},
      create: { userId, cycleNumber: 1, startDate: mondayOfCurrentWeek(new Date()) },
    }),
  ]);
}
