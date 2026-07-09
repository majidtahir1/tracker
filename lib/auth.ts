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

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  emailAndPassword: { enabled: true, minPasswordLength: 6 },
  // The Capacitor iOS shell reaches the dev server via the Mac's LAN IP,
  // which fails the CSRF origin check against BETTER_AUTH_URL (localhost).
  trustedOrigins: ["http://192.168.1.229:3000"],
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
