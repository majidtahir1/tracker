/**
 * One-time, idempotent rollout migration for the ownership schema.
 * Run after `prisma db push` and `npm run db:seed`.
 */
import { prisma } from "../lib/db";
import { cloneBuiltInProgram } from "../lib/program-access";

async function main(): Promise<void> {
  // The old exercise catalog was intentionally global. Preserve visibility but
  // make every legacy row immutable; new custom exercises receive an owner.
  const exercises = await prisma.exercise.updateMany({
    where: { ownerId: null },
    data: { isBuiltIn: true },
  });

  const users = await prisma.user.findMany({ select: { id: true } });
  const legacyPrograms = await prisma.program.findMany({
    where: { ownerId: null, isBuiltIn: false },
    select: { id: true, name: true },
  });
  let claimed = 0;
  let cloned = 0;
  let unresolved = 0;

  for (const program of legacyPrograms) {
    const activeFor = await prisma.appSettings.findMany({
      where: { activeProgramId: program.id },
      select: { userId: true },
    });

    if (activeFor.length === 0 && users.length === 1) {
      await prisma.program.update({ where: { id: program.id }, data: { ownerId: users[0].id } });
      claimed++;
      continue;
    }
    if (activeFor.length === 0) unresolved++;

    // A formerly shared active program becomes a private copy for every user.
    for (const { userId } of activeFor) {
      const programId = await cloneBuiltInProgram(userId, program.id);
      if (!programId) throw new Error(`Could not clone legacy program ${program.name}`);
      await prisma.appSettings.update({ where: { userId }, data: { activeProgramId: programId } });
      cloned++;
    }
  }

  console.log(
    `Ownership migration complete: ${exercises.count} exercises locked, ${claimed} programs claimed, ${cloned} active programs cloned.`,
  );
  if (unresolved > 0) {
    console.warn(`${unresolved} unreferenced legacy programs remain immutable because their owner cannot be inferred safely.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
