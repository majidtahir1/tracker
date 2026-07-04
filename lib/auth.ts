/**
 * Better Auth server instance. Username + password only — email is a
 * synthesized placeholder (`<username>@tracker.local`), no verification.
 */
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  emailAndPassword: { enabled: true },
  plugins: [username(), nextCookies()], // nextCookies must be last
});
