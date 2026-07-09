/** One-shot check that Better Auth can create + authenticate a user. */
import { auth } from "../lib/auth";

async function main() {
  const suffix = process.pid; // unique-ish per run
  const username = `smoketest${suffix}`;
  await auth.api.signUpEmail({
    body: {
      name: username,
      username,
      email: `${username}@tracker.local`,
      password: "test-password-123",
    },
  });
  const signIn = await auth.api.signInUsername({
    body: { username, password: "test-password-123" },
  });
  if (!signIn?.user?.id) throw new Error("sign-in returned no user");
  console.log(`OK: signed up + signed in as ${username} (${signIn.user.id})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
