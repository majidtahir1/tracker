# syntax=docker/dockerfile:1

# Tracker — production image.
# Multi-stage: build with full toolchain (better-sqlite3 is a native module),
# run on a slim base. Both stages use Debian bookworm so the compiled
# better-sqlite3 .node binary from the builder runs on the runner (same glibc).

# ---------- Builder ----------
FROM node:22-bookworm AS builder
WORKDIR /app

# Build toolchain for native deps (better-sqlite3). Cached unless it changes.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install deps first for layer caching. `postinstall` runs `prisma generate`.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# App source
COPY . .

# `next build` imports route modules (including lib/auth.ts). Provide harmless
# build-time placeholders so construction doesn't fail; real values are injected
# at runtime via env_file. DATABASE_URL points at a throwaway path — no queries
# run at build time (every page is force-dynamic).
ENV NODE_ENV=production \
    BETTER_AUTH_SECRET=build-placeholder-secret-0000000000000000 \
    BETTER_AUTH_URL=http://localhost:3000 \
    DATABASE_URL=file:/tmp/build.db
RUN npm run build

# ---------- Runner ----------
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Copy the fully-built app (includes node_modules with the compiled
# better-sqlite3 binary and the generated Prisma client in lib/generated).
COPY --from=builder /app /app

# The photo-upload route writes to public/photos (process.cwd()/public/photos).
# This dir is a volume mount at runtime; create it so the path exists on first run.
RUN mkdir -p /app/public/photos /data

EXPOSE 3000

# next start serves the .next build. Schema is applied out-of-band on first
# deploy / after schema changes (see docs/DEPLOYMENT.md) — NOT auto-run here,
# because `prisma db push` can drop columns on destructive schema changes.
CMD ["npm", "run", "start"]
