/** Proves per-user data isolation. Run: npx tsx scripts/smoke-multi-user.ts */
import { auth } from "../lib/auth";
import { prisma } from "../lib/db";

async function main() {
  const uname = `isotest${process.pid}`;
  const password = "isolation-test-99";
  const res = await auth.api.signUpEmail({
    body: { name: uname, username: uname, email: `${uname}@tracker.local`, password },
  });
  const newUserId = res.user.id;

  // Provisioning fired?
  const settings = await prisma.appSettings.findUnique({ where: { userId: newUserId } });
  const block = await prisma.trainingBlock.findFirst({ where: { userId: newUserId } });
  if (!settings) throw new Error("no AppSettings provisioned");
  if (!settings.activeProgramId) throw new Error("no active program provisioned");
  if (!block || block.cycleNumber !== 1) throw new Error("no TrainingBlock provisioned");

  // Isolation: brand-new user owns zero historical rows.
  const [sessions, prs, meas] = await Promise.all([
    prisma.workoutSession.count({ where: { userId: newUserId } }),
    prisma.personalRecord.count({ where: { userId: newUserId } }),
    prisma.bodyMeasurement.count({ where: { userId: newUserId } }),
  ]);
  if (sessions + prs + meas !== 0) throw new Error("new user sees pre-existing data!");

  // Owner still owns their history.
  const owner = await prisma.user.findFirst({ where: { username: "majid" } });
  if (!owner) throw new Error("owner account missing");
  const ownerSessions = await prisma.workoutSession.count({ where: { userId: owner.id } });
  if (ownerSessions === 0) throw new Error("owner lost their sessions!");
  console.log(`OK: new user isolated; owner retains ${ownerSessions} sessions.`);

  // Cleanup the test user (cascades wipe provisioned rows).
  await prisma.user.delete({ where: { id: newUserId } });
  const leftover = await prisma.appSettings.findUnique({ where: { userId: newUserId } });
  if (leftover) throw new Error("cascade delete left AppSettings behind");
  console.log("OK: cleanup done (cascades verified).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
