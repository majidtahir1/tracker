/**
 * Better Auth server instance. Username + password only — email is a
 * synthesized placeholder (`<username>@tracker.local`), no verification.
 */
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db";
import { provisionNewUser } from "@/lib/provision";

// Origins allowed past the CSRF check. In dev the Capacitor iOS shell reaches
// the dev server via the Mac's LAN IP (which differs from BETTER_AUTH_URL);
// in production set BETTER_AUTH_TRUSTED_ORIGINS to your public HTTPS domain
// (comma-separated). Falls back to the historical dev LAN IP when unset.
const trustedOrigins = (
  process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "http://192.168.1.229:3000"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  emailAndPassword: { enabled: true, minPasswordLength: 6 },
  trustedOrigins,
  plugins: [username(), nextCookies()], // nextCookies must be last
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            await provisionNewUser(user.id);
          } catch (err) {
            console.error("provisioning failed for user", user.id, err);
          }
        },
      },
    },
  },
});
