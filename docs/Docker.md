# Docker — local development

Run the web app (and optionally local Supabase) with Docker Compose.

## Prerequisites

| Tool | Purpose |
|------|---------|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine + Compose v2 | Run containers |
| [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) | Optional — local Postgres, Auth, Realtime (`supabase start`) |

## Quick start (app + local Supabase)

**Windows (PowerShell):**

```powershell
.\docker\up.ps1
```

**macOS / Linux:**

```bash
chmod +x docker/up.sh docker/down.sh
./docker/up.sh
```

This will:

1. Create `.env.docker` from `.env.docker.example` if missing
2. Run `supabase start` and `supabase db reset --local` (applies `supabase/migrations/`)
3. Refresh `.env.docker` with keys from `supabase status -o env` when possible
4. Start the app at **http://localhost:5173**

Stop everything:

```powershell
.\docker\down.ps1
```

```bash
./docker/down.sh
```

## App only (Supabase Cloud or custom env)

1. Copy env file and set your project keys:

   ```bash
   cp .env.docker.example .env.docker
   ```

2. Start the container:

   ```bash
   npm run docker:up
   ```

   Or: `docker compose up --build`

The app bind-mounts the repo for hot reload. `node_modules` lives in a named Docker volume.

### Env notes for Docker

| Variable | Where it runs | Typical local value |
|----------|----------------|---------------------|
| `VITE_SUPABASE_URL` | Browser | `http://localhost:54321` |
| `SUPABASE_URL` | Server (SSR / server functions) | `http://host.docker.internal:54321` |
| `VITE_APP_ORIGIN` | Browser (optional) | `http://localhost:5173` — only needed if testing QR links to a fixed public URL |

Default keys in `.env.docker.example` match the **Supabase CLI local** demo JWTs. Cloud projects use keys from the Supabase dashboard instead.

## Production preview (optional)

Build and serve the production bundle inside Docker:

```bash
cp .env.docker.example .env.docker
docker compose --profile preview up --build app-preview
```

Open **http://localhost:4173**. SSR/server functions still need `SUPABASE_URL` reachable from the container (often `host.docker.internal`).

## URLs (same as native dev)

| URL | Purpose |
|-----|---------|
| http://localhost:5173/ | TV / game |
| http://localhost:5173/controller?session=…&token=… | Phone controller |
| http://localhost:5173/admin | Admin panel |
| http://localhost:5173/scoreboard | Leaderboard |
| http://localhost:54323 | Supabase Studio (when using `supabase start`) |

## Troubleshooting

- **Realtime / WebSocket errors from the phone** — use your machine’s LAN IP in the QR URL, or test with the TV and phone on the same network; Docker does not change this requirement.
- **Linux: `host.docker.internal` missing** — Compose adds `extra_hosts: host-gateway`; if SSR still cannot reach Supabase, set `SUPABASE_URL=http://172.17.0.1:54321` (Docker bridge gateway).
- **File changes not detected on Windows** — polling is enabled via `CHOKIDAR_USEPOLLING` / `WATCHPACK_POLLING` in `docker-compose.yml`.
- **No Supabase CLI** — use cloud keys in `.env.docker` and run `npm run docker:up` only.

See also [Setup.md](./Setup.md) and [Deployment.md](./Deployment.md).
