# Setup & Prerequisites — ABYSSAL (Sonar Deep Dives)

This guide covers what you need installed, how to configure Supabase, and how to run the app locally before deploying. For production hosting, see [Deployment.md](./Deployment.md).

---

## 1. Prerequisites

### 1.1 Required software

| Tool | Minimum version | Purpose |
|------|-----------------|--------|
| [Node.js](https://nodejs.org/) | **20.19+** or **22.x** (LTS recommended) | Vite 7, TanStack Start, TypeScript |
| [Bun](https://bun.sh/) | **1.1+** (recommended) | Fast install/dev (repo includes `bun.lockb`) |
| [Git](https://git-scm.com/) | Any recent | Clone and version control |
| [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) | **1.200+** | Apply database migrations locally or to cloud |

**Alternative:** You can use **npm** instead of Bun (`npm install`, `npm run dev`) if `package-lock.json` is present — Bun is the path used in project docs.

### 1.2 Required accounts & services

| Service | Required? | Purpose |
|---------|-------------|---------|
| [Supabase](https://supabase.com) project | **Yes** | PostgreSQL, Auth, Realtime, RLS |
| [Lovable](https://lovable.dev) or [Cloudflare](https://dash.cloudflare.com) | For production deploy only | Host TanStack Start (SSR + server functions) |
| [Umami](https://umami.is) or other analytics | No | Optional; configured in admin panel |

### 1.3 Optional (production / advanced)

| Tool | Purpose |
|------|---------|
| [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) | Deploy to Cloudflare Workers without Lovable |
| [Docker](https://www.docker.com/) | Optional — run the app (and orchestrate local Supabase) via [Docker.md](./Docker.md) |

### 1.4 Booth / venue network (events)

For live play, ensure:

- **HTTPS** to your game domain (QR codes and secure cookies).
- **WebSockets** allowed to `*.supabase.co` (Realtime Broadcast).
- **Stable Wi-Fi** for TV and visitor phones (latency affects controller feel).

---

## 2. Repository setup

```bash
git clone <your-repo-url>
cd sonar-deep-dives
```

### 2.1 Install dependencies

**With Bun (recommended):**

```bash
bun install
```

**With npm:**

```bash
npm install
```

### 2.2 Environment variables

1. Copy the example file:

   ```bash
   cp .env.example .env
   ```

2. In [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Project Settings** → **API**, copy:
   - **Project URL** → `VITE_SUPABASE_URL` and `SUPABASE_URL`
   - **anon / publishable** key → `VITE_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_PUBLISHABLE_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (server only; never commit or expose as `VITE_*`)

3. Optional: set `ADMIN_BOOTSTRAP_EMAILS` to your operator email for `/admin` access on first login.

4. Recommended for production / booth builds: set `VITE_APP_ORIGIN` to your public game URL (same host visitors scan from the QR). Optional: `VITE_OG_IMAGE_URL` for social preview images.

See [Deployment.md §4](./Deployment.md#4-environment-variables) for variable reference.

---

## 3. Supabase setup

### 3.1 Create a project

1. Sign in at [supabase.com](https://supabase.com) and create a new project.
2. Choose a **region** close to your users (e.g. EU for European events).
3. Save the database password (needed for CLI linking).

### 3.2 Apply migrations

From the repo root, with Supabase CLI installed and logged in (`supabase login`):

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

All SQL files under `supabase/migrations/` must be applied, including security and Realtime policies.

**Verify:** In **Table Editor**, you should see `game_config`, `game_sessions`, `game_scores`, `player_registrations` (columns include `company`), `admin_users`, and a seed row in `game_config`.

### 3.3 Authentication (admin panel)

1. **Authentication → Providers** → enable **Email**.
2. **Authentication → Users** → create an operator user (email + password).
3. Grant admin access (pick one):
   - Set `ADMIN_BOOTSTRAP_EMAILS=that-email@company.com` in `.env`, sign in once at `/admin`, or
   - User **App Metadata** → `{ "role": "admin" }`, or
   - SQL: `INSERT INTO admin_users (user_id, email) SELECT id, email FROM auth.users WHERE email = '...';`

Full steps: [Deployment.md → Admin operators](./Deployment.md#admin-operators).

### 3.4 Realtime

1. **Project → Realtime → Settings**
2. Disable **“Allow public access”** (required for private Broadcast channels + RLS).
3. Confirm **Realtime** is enabled for the project (default on Supabase Cloud).

### 3.5 Local Supabase (optional)

To run Postgres + Auth locally instead of cloud:

```bash
supabase start
supabase db reset   # applies migrations to local instance
```

Use the local API URL and keys printed by `supabase status` in your `.env`.

---

## 4. Run locally

**Native (Node/Bun on the host):**

```bash
bun run dev
```

Or: `npm run dev`

**Docker Compose** (app in a container; optional local Supabase via CLI):

See **[Docker.md](./Docker.md)** — `.\docker\up.ps1` (Windows) or `./docker/up.sh` (macOS/Linux), or `npm run docker:up` for the app only.

The dev server URL is printed in the terminal (often `http://localhost:5173` — port may be set by `@lovable.dev/vite-tanstack-config`).

| URL | Purpose |
|-----|---------|
| `/` | TV / game display |
| `/controller?session=…&token=…` | Phone controller (use QR from TV, or copy URL from TV waiting screen) |
| `/admin` | Operator console (Supabase Auth sign-in) |
| `/scoreboard` | Public leaderboard |

### 4.1 Other scripts

| Command | Description |
|---------|-------------|
| `bun run build` | Production build |
| `bun run build:dev` | Development-mode build |
| `bun run preview` | Preview production build locally |
| `bun run lint` | ESLint |
| `npm test` | Vitest unit tests (one-shot) |
| `npm run test:watch` | Vitest in watch mode |

### 4.2 Production preview (Cloudflare)

If deploying with Wrangler:

```bash
bun run build
npx wrangler dev    # local Workers runtime
# or
npx wrangler deploy
```

Set secrets via `wrangler secret put` (see [Deployment.md](./Deployment.md)).

---

## 5. Verify local setup

Use this checklist before relying on the app for an event:

- [ ] `bun run dev` starts without “Missing Supabase environment variables”
- [ ] `/` loads waiting screen with QR and 6-character session code
- [ ] Phone scan (full QR with `session` + `token`) → registration form → game starts on TV
- [ ] Score appears on `/scoreboard` after game over
- [ ] `/admin` sign-in works; branding save succeeds (needs `SUPABASE_SERVICE_ROLE_KEY` in `.env`)
- [ ] `bun run build` completes without errors

---

## 6. Troubleshooting (local)

| Problem | Likely fix |
|---------|------------|
| Missing Supabase env vars | Copy `.env.example` → `.env`; fill all `VITE_*` keys |
| Admin save fails | Add `SUPABASE_SERVICE_ROLE_KEY` to `.env`; restart dev server |
| Admin “not authorized” | Add user to `admin_users` or `ADMIN_BOOTSTRAP_EMAILS`; enable Email provider |
| Controller won’t connect | Apply migrations; disable Realtime public access; scan fresh QR (token rotates) |
| Realtime / channel errors | Confirm `20260515120300` and `20260515120500` migrations applied |
| Port already in use | Stop other Vite apps or change port in tooling config |

---

## 7. Related documentation

| Document | Contents |
|----------|----------|
| [Deployment.md](./Deployment.md) | Production deploy, providers, event checklist |
| [Solution Design](./solution-design.md) | Architecture and data model |
| [Improvement Report](./improvement-report.md) | Known gaps and roadmap |
| [../README.md](../README.md) | Product overview and gameplay |
