import path from "node:path";
import { defineConfig } from "prisma/config";
import { loadEnvConfig } from "@next/env";

// Prisma 7 config files don't auto-load .env, so load it the same way Next
// does — CLI commands (db push / seed) must resolve the same DATABASE_URL as
// the runtime adapter in lib/db.ts, or they'll silently target different DBs.
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
