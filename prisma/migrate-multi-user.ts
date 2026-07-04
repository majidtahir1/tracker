/**
 * One-time migration: creates the owner account and assigns all existing
 * (userId = NULL) rows to it. Idempotent: re-running skips rows already owned.
 * Usage: MIGRATE_USERNAME=maj MIGRATE_PASSWORD=... npm run db:migrate-users
 */
import { auth } from "../lib/auth";
import { prisma } from "../lib/db";

async function main() {
  const username = process.env.MIGRATE_USERNAME;
  const password = process.env.MIGRATE_PASSWORD;
  if (!username || !password) {
    throw new Error("Set MIGRATE_USERNAME and MIGRATE_PASSWORD env vars.");
  }

  // 1. Owner account (reuse if the username already exists).
  let user = await prisma.user.findFirst({ where: { username: username.toLowerCase() } });
  if (!user) {
    const res = await auth.api.signUpEmail({
      body: { name: username, username, email: `${username}@tracker.local`, password },
    });
    user = await prisma.user.findUniqueOrThrow({ where: { id: res.user.id } });
    console.log(`Created owner account ${username} (${user.id})`);
  } else {
    console.log(`Owner account ${username} already exists (${user.id})`);
  }
  const userId = user.id;

  // 2. Backfill userId on all orphaned rows.
  const tables = [
    "trainingBlock", "workoutSession", "personalRecord", "bodyMeasurement",
    "progressPhoto", "nutritionLog", "recoveryLog", "goal", "notification",
    "coachBrief", "substitutionEvent", "whoopCycle", "whoopRecovery",
    "whoopSleep", "whoopWorkout",
  ] as const;
  for (const t of tables) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (prisma[t] as any).updateMany({
      where: { userId: null },
      data: { userId },
    });
    console.log(`  ${t}: ${count} rows claimed`);
  }

  // 3. Singletons -> owner rows. activeProgramId from the old isActive flag.
  const activeProgram = await prisma.program.findFirst({ where: { isActive: true } });
  await prisma.appSettings.updateMany({
    where: { userId: null },
    data: { userId, activeProgramId: activeProgram?.id ?? null },
  });
  await prisma.whoopConnection.updateMany({ where: { userId: null }, data: { userId } });

  // 4. Favorites -> UserExercisePref.
  const favorites = await prisma.exercise.findMany({ where: { isFavorite: true } });
  for (const ex of favorites) {
    await prisma.userExercisePref.upsert({
      where: { userId_exerciseId: { userId, exerciseId: ex.id } },
      update: { isFavorite: true },
      create: { userId, exerciseId: ex.id, isFavorite: true },
    });
  }
  console.log(`  favorites migrated: ${favorites.length}`);

  // 5. Report anything left unclaimed (should be zero everywhere).
  for (const t of tables) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const left = await (prisma[t] as any).count({ where: { userId: null } });
    if (left > 0) console.warn(`  WARNING: ${t} still has ${left} unowned rows`);
  }
  console.log("Migration complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
