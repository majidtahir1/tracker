# Deploying Tracker (home lab + iOS App Store)

This is a Next.js web app/API plus a **locally bundled Capacitor client**. The
iOS binary contains its React UI and calls the HTTPS backend with a bearer
session. User data still requires the Node server, writable SQLite database,
and private photo storage, but app startup and navigation do not depend on
downloading a remote interface.

- **Hosting model chosen:** Path 1 — keep SQLite, single always-on container on
  your home lab, behind your existing reverse proxy (which terminates TLS).
- **Scale note:** SQLite + local-disk photos means **one instance only** (no
  horizontal scaling). Fine for personal/small use. To scale later, see
  `docs/superpowers/specs/2026-07-10-postgres-object-storage-migration.md`.

---

## Architecture at a glance

```
 iPhone (bundled React + Capacitor)           Home lab host
 ┌───────────────────────────┐        ┌──────────────────────────────────────┐
 │ local dist-mobile assets  │  HTTPS │  Reverse proxy (Traefik / NPM / Caddy) │
 │ bearer-auth API calls     │ ─────► │  terminates TLS for tracker.dom.com    │
 └───────────────────────────┘        │        │ http (loopback / proxy net)   │
                                       │        ▼                               │
                                       │  tracker container (next start :3000)  │
                                       │   ├─ web pages + server actions        │
                                       │   ├─ /api/auth, /api/mobile, /api/photos │
                                       │   ├─ /data/tracker.db   (volume)        │
                                       │   └─ /data/photos        (volume)        │
                                       └──────────────────────────────────────┘
                                        WHOOP OAuth ↔ api.prod.whoop.com
                                        MiniMax AI  ↔ api.minimax.io (optional)
```

Everything data-facing runs in the container. The app bundle contains UI code,
not user health data or service credentials.

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
#   BETTER_AUTH_TRUSTED_ORIGINS=https://tracker.yourdomain.com,capacitor://localhost
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

1. **Open signup, no email verification / rate limiting** — anyone with the URL
   can create an account. Consider: disable open signup (invite/manual), add
   rate limiting at the reverse proxy, or a signup allowlist.
2. **Secrets** live only in `.env.production` (gitignored) and the container env —
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

Delete backups older than 30 days. The public privacy policy commits to this
maximum retention period, so the backup host must enforce that rotation.

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

### 5.1 Build and sync the local client

The production API defaults to `https://progression.fit`. Override
`VITE_API_URL` during `mobile:build` only when targeting a different backend.
Build the local assets and sync plugins/configuration into Xcode:
```bash
npm run ios:sync
```
The generated `ios/App/App/capacitor.config.json` must not contain `server.url`.
`CAP_DEV_SERVER` remains available for local live-reload development only.

### 5.2 Build & submit

1. `npx cap open ios` → Xcode.
2. Confirm the **Bundle Identifier** is `fit.progression.app`, select the signing
   Team, and verify Push Notifications capability for the distribution profile.
3. Product → Archive → distribute to **TestFlight**, then submit for review in
   **App Store Connect**.

### 5.3 App Review notes

Tell App Review that the interface is bundled, progress photos use the native
Camera plugin, and push permission is requested in Settings. Provide a populated
demo account and keep the backend/APNs production services available throughout
review.

---

## 6. What had to change vs. dev (summary)

| Concern | Dev (before) | Production |
|---|---|---|
| DB | `prisma/dev.db` in repo root | `/data/tracker.db` on a mounted volume |
| Photos | `var/photos` in repo | `/data/photos` on a mounted volume |
| Origin | `http://192.168.1.229:3000` (LAN IP) | `https://tracker.yourdomain.com` |
| Auth trusted origins | hardcoded LAN IP | `BETTER_AUTH_TRUSTED_ORIGINS` env |
| WHOOP redirect | `localhost` | prod domain (re-registered) |
| TLS | cleartext | terminated at reverse proxy |
| iOS web layer | optional `CAP_DEV_SERVER` live reload | bundled `dist-mobile` assets |
