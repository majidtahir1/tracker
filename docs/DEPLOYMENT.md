# Deploying Tracker (home lab + iOS App Store)

This is a **server-first Next.js app**. The iOS app is a thin Capacitor WKWebView
that loads a **remote URL** — almost nothing is bundled into it. Every screen
needs a running Node server with a writable SQLite database and local disk for
photos. To ship on iOS you host the server, point the app at its HTTPS domain,
and submit through Xcode/TestFlight.

- **Hosting model chosen:** Path 1 — keep SQLite, single always-on container on
  your home lab, behind your existing reverse proxy (which terminates TLS).
- **Scale note:** SQLite + local-disk photos means **one instance only** (no
  horizontal scaling). Fine for personal/small use. To scale later, see
  `docs/superpowers/specs/2026-07-10-postgres-object-storage-migration.md`.

---

## Architecture at a glance

```
 iPhone (Capacitor WKWebView)                Home lab host
 ┌───────────────────────────┐        ┌──────────────────────────────────────┐
 │ server.url =              │  HTTPS │  Reverse proxy (Traefik / NPM / Caddy) │
 │ https://tracker.dom.com   │ ─────► │  terminates TLS for tracker.dom.com    │
 └───────────────────────────┘        │        │ http (loopback / proxy net)   │
                                       │        ▼                               │
                                       │  tracker container (next start :3000)  │
                                       │   ├─ RSC pages + server actions        │
                                       │   ├─ /api/auth, /api/photos, /api/whoop │
                                       │   ├─ /data/tracker.db   (volume)        │
                                       │   └─ /app/public/photos (volume)        │
                                       └──────────────────────────────────────┘
                                        WHOOP OAuth ↔ api.prod.whoop.com
                                        MiniMax AI  ↔ api.minimax.io (optional)
```

Everything data-facing runs in the container. Nothing sensitive lives in the app binary.

---

## Prerequisites

- A host on your home lab with **Docker** + **Docker Compose v2**.
- A **domain/subdomain** you control (e.g. `tracker.yourdomain.com`) with a DNS
  record resolving to your public entry point, and your existing reverse proxy
  configured to route that hostname.
- Your reverse proxy handles **HTTPS** (Let's Encrypt or Cloudflare). The app
  itself speaks plain HTTP on port 3000 behind it — never expose 3000 publicly.
- A Mac with **Xcode** for the iOS build (App Store submission).

> ⚠️ **Modified Next.js.** `AGENTS.md` warns this repo runs a modified Next 16
> with breaking changes vs. stock. The Dockerfile uses `next build` + `next start`
> (not `output: standalone`) to stay on the supported path and to avoid
> file-tracing issues with the native `better-sqlite3` module and the custom
> Prisma client output (`lib/generated/prisma`). Verify a local `docker compose
> build` before relying on it.

---

## 1. Server deployment (home lab)

### 1.1 Files in this repo

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage build (bookworm builder → slim runner); native `better-sqlite3` compiled in the builder. |
| `docker-compose.yml` | Runs the app, mounts `./data` (DB) and `./photos` (uploads), publishes `127.0.0.1:3000`. |
| `.env.production.example` | Template for runtime secrets; copy to `.env.production`. |
| `.dockerignore` | Keeps local DB, secrets, iOS shell, and docs out of the image. |

### 1.2 Configure environment

```bash
cp .env.production.example .env.production
# then edit .env.production:
#   BETTER_AUTH_URL=https://tracker.yourdomain.com
#   BETTER_AUTH_SECRET=$(openssl rand -base64 48)
#   BETTER_AUTH_TRUSTED_ORIGINS=https://tracker.yourdomain.com
#   WHOOP_* / MINIMAX_*  (optional)
```

`DATABASE_URL` is set to `file:/data/tracker.db` by `docker-compose.yml` (the
mounted volume) — leave it unset in `.env.production`.

`lib/auth.ts` now reads `BETTER_AUTH_TRUSTED_ORIGINS` from the environment (it
previously hardcoded the dev LAN IP). No code edit needed for production — just
set the env var.

### 1.3 Build and initialize the database

```bash
docker compose build

# First deploy: create the schema, seed immutable catalog data, then claim or
# clone any pre-ownership records (the migration is safe to rerun).
docker compose run --rm app npx prisma db push
docker compose run --rm app npm run db:seed
docker compose run --rm app npm run db:migrate-security-ownership
```

> `prisma db push` is also how you apply **schema changes on upgrades** — this
> app has no migration history, it uses push. On a destructive schema change,
> push can drop columns; back up `./data/tracker.db` first (see §4).

### 1.4 Start

```bash
docker compose up -d
docker compose logs -f app        # expect: "Ready in ..." on :3000
curl -sf http://127.0.0.1:3000/login >/dev/null && echo OK
```

### 1.5 Wire up your reverse proxy

TLS terminates at your proxy; forward `tracker.yourdomain.com` → `http://<host>:3000`.

**Nginx Proxy Manager:** New Proxy Host → domain `tracker.yourdomain.com`,
Forward Hostname/IP = the Docker host, Forward Port `3000`, enable Block Common
Exploits and Websockets, request a Let's Encrypt cert on the SSL tab.

**Traefik (labels, if you put the app on the proxy's network):** uncomment the
`networks:` block in `docker-compose.yml` (remove the `ports:` block) and add:

```yaml
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.tracker.rule=Host(`tracker.yourdomain.com`)"
      - "traefik.http.routers.tracker.entrypoints=websecure"
      - "traefik.http.routers.tracker.tls.certresolver=le"
      - "traefik.http.services.tracker.loadbalancer.server.port=3000"
```

**Caddy (Caddyfile):**

```
tracker.yourdomain.com {
    reverse_proxy 127.0.0.1:3000
}
```

**Proxy-on-another-machine:** change the compose port to `0.0.0.0:3000:3000`
and firewall port 3000 to the proxy host only.

### 1.6 Verify end-to-end

Open `https://tracker.yourdomain.com/login` in a browser. Create an account, log
in, confirm the dashboard renders and the theme toggle works. If login fails with
a CSRF/origin error, re-check `BETTER_AUTH_URL` and `BETTER_AUTH_TRUSTED_ORIGINS`
both equal the exact HTTPS domain.

---

## 2. Hardening before public exposure

Once this is on the public internet (not just your LAN), address these — they're
acceptable on a trusted LAN but not publicly:

1. **Progress photos are served unauthenticated** by path. `/photos/*` is excluded
   from the auth middleware (`proxy.ts`) and any file under `public/photos/` is
   readable by anyone who knows/guesses the URL — this is body/health imagery.
   Mitigations: put the photo path behind auth (move retrieval through an
   authenticated route handler), or at minimum use long random filenames and a
   proxy `Referer`/auth rule. Tracked as a follow-up.
2. **Open signup, no email verification / rate limiting** — anyone with the URL
   can create an account. Consider: disable open signup (invite/manual), add
   rate limiting at the reverse proxy, or a signup allowlist.
3. **Secrets** live only in `.env.production` (gitignored) and the container env —
   never in the image or git. Rotate `BETTER_AUTH_SECRET` invalidates sessions.

---

## 3. External integrations (update redirect/allowed URLs)

- **WHOOP:** in the WHOOP developer console, set the app's redirect URI to
  `https://tracker.yourdomain.com/api/whoop/callback` (must match
  `WHOOP_REDIRECT_URI` exactly). Existing tokens in the DB keep working; the
  callback URL only matters for new authorizations.
- **MiniMax:** no callback; just the server-side API key. Optional feature —
  omit the keys and the AI features stay disabled.

---

## 4. Operations

**Backups (do this before every upgrade):**
```bash
# SQLite: copy the file while the app is briefly stopped, or use the online backup.
docker compose stop app
cp ./data/tracker.db ./backups/tracker-$(date +%F).db
cp -r ./photos ./backups/photos-$(date +%F)
docker compose start app
```

**Upgrade (new code):**
```bash
git pull
docker compose build
docker compose run --rm app npx prisma db push   # if schema changed
docker compose run --rm app npm run db:seed
docker compose run --rm app npm run db:migrate-security-ownership
docker compose up -d
```

**Where state lives:** `./data/tracker.db` (all app data + WHOOP tokens) and
`./photos/` (uploads). Back these two up; everything else is rebuildable.

---

## 5. iOS app (App Store)

### 5.1 Point the shell at production

Edit `capacitor.config.ts`:
```ts
server: {
  url: "https://tracker.yourdomain.com",
  // remove `cleartext: true` — production is HTTPS
},
```
Then sync the native project:
```bash
npx cap sync ios
```
This also updates the mirrored `ios/App/App/capacitor.config.json`.

### 5.2 Build & submit

1. `npx cap open ios` → Xcode.
2. Set the **Bundle Identifier** (`com.majidtahir.tracker`), your Team/signing,
   and provide **app icons + launch screen** (the current `ios/App/App/public`
   holds only stale placeholder assets).
3. Product → Archive → distribute to **TestFlight**, then submit for review in
   **App Store Connect**.

### 5.3 ⚠️ App Review risk — Guideline 4.2 (minimum functionality)

As-is, this is a **pure remote-URL webview wrapper** with no native features and
no offline capability. Apple frequently rejects these. Before submitting, plan
the native surface (push notifications via APNs — there's already a disabled
notifications stub, Capacitor Camera for photos, offline resilience). This is
scoped separately in
`docs/superpowers/specs/2026-07-10-app-store-native-readiness.md`. Treat that as
a prerequisite for a smooth review, not an afterthought.

---

## 6. What had to change vs. dev (summary)

| Concern | Dev (before) | Production |
|---|---|---|
| DB | `prisma/dev.db` in repo root | `/data/tracker.db` on a mounted volume |
| Photos | `public/photos` in repo | `/app/public/photos` on a mounted volume |
| Origin | `http://192.168.1.229:3000` (LAN IP) | `https://tracker.yourdomain.com` |
| Auth trusted origins | hardcoded LAN IP | `BETTER_AUTH_TRUSTED_ORIGINS` env |
| WHOOP redirect | `localhost` | prod domain (re-registered) |
| TLS | cleartext | terminated at reverse proxy |
| iOS `server.url` | LAN IP + cleartext | prod HTTPS domain |
