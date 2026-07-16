/**
 * One-time, idempotent repair: re-claim programs the seed hijacked.
 *
 * The pre-fix seed upserted the starter by NAME, so a user-owned
 * "UPPER / LOWER" (claimed by the multi-user migration) had its ownerId
 * nulled and isBuiltIn set — leaving the user's activeProgramId pointing at
 * a program the owned-only dashboard/workout queries can no longer see.
 *
 * For each unowned program that is exactly one user's active program and
 * carries that user's workout history, give it back: ownerId = user,
 * isBuiltIn = false, renamed with the "— My Copy" convention so the
 * canonical name frees up for the (fixed) seed to recreate the built-in.
 *
 * Run BEFORE re-running the seed:
 *   npx tsx scripts/repair-starter-ownership.ts && npx tsx prisma/seed.ts
 */
import { prisma } from "../lib/db";
import { cloneBuiltInProgram } from "../lib/program-access";

async function main(): Promise<void> {
  const suspects = await prisma.program.findMany({
    where: { ownerId: null },
    select: { id: true, name: true, isBuiltIn: true },
  });

  let repaired = 0;
  for (const program of suspects) {
    const activeFor = await prisma.appSettings.findMany({
      where: { activeProgramId: program.id },
      select: { userId: true },
    });
    if (activeFor.length !== 1) {
      if (activeFor.length > 1) {
        console.warn(`skip ${program.name} (${program.id}): active for ${activeFor.length} users — resolve manually`);
      }
      continue;
    }
    const userId = activeFor[0].userId;
    const history = await prisma.workoutSession.count({
      where: { userId, template: { programId: program.id } },
    });
    if (history === 0) {
      // Active but never trained: nothing of theirs lives on this program,
      // so leave it shared and point them at a fresh owned clone instead —
      // the owned-only dashboard/workout queries need an owned program.
      const cloneId = await cloneBuiltInProgram(userId, program.id);
      if (cloneId) {
        await prisma.appSettings.update({ where: { userId }, data: { activeProgramId: cloneId } });
        repaired++;
        console.log(`cloned "${program.name}" for user ${userId} (no history) and activated the clone`);
      }
      continue;
    }

    let name = `${program.name} — My Copy`;
    let suffix = 2;
    while (await prisma.program.findUnique({ where: { name }, select: { id: true } })) {
      name = `${program.name} — My Copy ${suffix++}`;
    }
    await prisma.program.update({
      where: { id: program.id },
      data: { ownerId: userId, isBuiltIn: false, name },
    });
    repaired++;
    console.log(`re-claimed "${program.name}" -> "${name}" for user ${userId} (${history} sessions)`);
  }

  console.log(`Repair complete: ${repaired} program(s) re-claimed. Now re-run the seed to restore the built-in starter.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
