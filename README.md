# ABYSSAL — Sonar Field Test Game

> A conference engagement game where visitors use their **phone as a wireless controller** to pilot a submarine on a large **TV/display screen**. Built for driving foot traffic to your booth.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/T-REX-XP/sonar-deep-dives)

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Node.js** 20.19+ or 22.x | [nodejs.org](https://nodejs.org/) |
| **Bun** 1.1+ (recommended) or **npm** | Install deps and run scripts |
| **Git** | Clone this repository |
| **Supabase** project | Database, Auth, Realtime — [supabase.com](https://supabase.com) |
| **Supabase CLI** | Apply migrations: `supabase link` + `supabase db push` |

Optional for deploy: [Lovable](https://lovable.dev) or [Cloudflare Wrangler](https://developers.cloudflare.com/workers/wrangler/).  
Full install steps: **[docs/Setup.md](docs/Setup.md)** · Production: **[docs/Deployment.md](docs/Deployment.md)**

---

## Getting started (local development)

1. **Clone and install**
   ```bash
   git clone <your-repo-url>
   cd sonar-deep-dives
   bun install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Fill in Supabase URL, publishable key, and service role key from **Dashboard → Project Settings → API**. See [.env.example](.env.example).

3. **Apply database migrations**
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

4. **Configure Supabase**
   - Enable **Email** auth provider; create an admin user ([docs/Deployment.md → Admin operators](docs/Deployment.md#admin-operators)).
   - **Realtime → Settings:** disable **Allow public access**.

5. **Run the app**
   ```bash
   bun run dev
   ```
   Open `/` on a display, `/admin` to sign in, scan the QR with a phone for `/controller`.

| Script | Command |
|--------|---------|
| Development | `bun run dev` |
| Production build | `bun run build` |
| Lint | `bun run lint` |
| Unit tests | `npm test` (or `npm run test:watch`) |
| Docker (local dev) | [docs/Docker.md](docs/Docker.md) — `npm run docker:up` or `docker/up.ps1` |
| Deploy to Cloudflare | [docs/Cloudflare-Deploy.md](docs/Cloudflare-Deploy.md) — manual or **GitHub Actions** on push to `main` |
| Regenerate Supabase types | `npm run gen:types` (local Supabase running) |

---

## 🎮 How It Works

1. **TV/Display** shows the waiting screen with a QR code and a **6-character session code** (e.g. `K7W3NP`). The QR includes a secret join token — scan the code; do not type the URL manually.
2. **Visitor** scans the QR → opens `/controller?session=…&token=…`.
3. Visitor completes **operator registration** (first/last name, company, work email, GDPR consent) and taps **ENGAGE**.
4. The TV accepts the join, shows **DIVE** on screen (or auto-starts when linked), and the phone becomes the joystick.
5. When the hull is breached, the score is saved to Postgres and the local TV leaderboard; the phone can restart up to **3 dives** per session.
6. After game over, the operator ends the session on the **phone** (EXIT or END SESSION). The TV then returns to the waiting lobby with a **new join token** (fresh QR) for the next player.

Each screen generates its own unique session code, so **multiple TVs can run simultaneously** without interference.

---

## 📄 Pages

| Route | Purpose | Access |
|---|---|---|
| `/` | **Main game** — TV/monitor. Waiting screen (QR + session code), then Canvas gameplay. | Public |
| `/controller?session=XXXXXX&token=…` | **Phone controller** — registration → joystick + TRP/SNR buttons. | Public (via QR) |
| `/scoreboard` | **Global scoreboard** — ranked runs from `game_scores`. | Public |
| `/admin` | **Admin panel** — seven sections below; Supabase Auth. | Operators only |

---

## 🔐 Admin Panel

**URL:** `/admin`  
**Sign-in:** Supabase Auth (email + password) for allowlisted operators — see [docs/Deployment.md](docs/Deployment.md#admin-operators).

### Sections (sidebar order)

| # | Section | Description |
|---|---------|-------------|
| 1 | **Overview** | Live stats: active sessions, games played, top score |
| 2 | **Branding** | Game name, titles, mission text, controller header/footer, site footer |
| 3 | **Feature Toggles** | Logo, slogan, QR, mission panel, share buttons, footer text |
| 4 | **Gameplay Tuning** | All balance numbers (see [defaults table](#gameplay-defaults-admin--gameplay-tuning)); validated on save |
| 5 | **Umami Analytics** | Optional `umami_script_url` + `umami_website_id` |
| 6 | **Sessions** | `game_sessions` history; clear all sessions (service role) |
| 7 | **Scoreboard** | `game_scores`; filter by session; clear all scores |

Config changes apply to new gameplay immediately via React Query (TV/controller refetch on save and on `game_config` DB updates).

---

## 🏷️ White-Labeling (Branding Tab)

All text displayed on the game screen and controller can be customized from the admin panel without code changes:

| Field | Where it appears | Default |
|---|---|---|
| **Game Name** | Main logo on TV + controller | `ABYSSAL` |
| **Title** | Below the logo | `SONAR FIELD TEST` |
| **Subtitle** | Above the logo | `SONAR SENSOR SYSTEMS // FIELD TEST UNIT` |
| **Mission Description** | Lore panel on the waiting screen | _(Drone ORCA-7 briefing text)_ |
| **Controller Header** | Top of phone controller screen | `SONAR SENSOR SYSTEMS // REMOTE CONTROLLER` |
| **Controller Footer** | Bottom of phone controller screen | `SONAR SENSOR SYSTEMS // REMOTE FIELD CONTROLLER` |
| **Footer Text** | Global footer on all pages (when toggle on) | `SONAR FIELD TEST v2.1 // VISIT OUR BOOTH` |

Changes are saved to `game_config` and picked up by open clients without redeploying the app.

---

## 🕹️ Gameplay

### Controls (Phone Controller)

| Control | Action |
|---|---|
| **Joystick** | Steer + thrust (when pushed far enough) |
| **TRP** | Fire torpedo (costs battery) |
| **SNR** | Sonar pulse — expanding cone reveals threats |
| **RST** | Request restart after hull breach (up to 3 dives per phone session) |
| **EXIT** | Leave session (`player_left` → TV returns to waiting lobby) |

### Controls (TV — keyboard / on-screen touch)

| Key / Action | Function |
|---|---|
| `W` / `↑` | Thrust |
| `A` / `D` or `←` / `→` | Rotate |
| `F` | Torpedo |
| `Space` | Sonar |
| `R` | Restart after game over |
| Touch joystick + TRP/SNR (mobile TV) | Same as phone overlay when not using remote |

### Game Mechanics

- **Lives, HP, battery** — tunable in admin; defaults: 3 lives, 5 HP, battery drains while thrusting
- **Sonar** — default 6s cooldown, ~7s beam duration, 90° FOV (see defaults table)
- **Torpedoes** — default 0.22s cooldown; each shot costs battery
- **Waves** — spawn groups on a timer; interval shrinks as waves increase
- **Anti-camping** — idle sub spawns extra hunters near the player
- **Session lifecycle** — link-lost (~10s) and idle (~30s) timeouts return TV to QR lobby; join token rotates

### Threats & collectibles

| Type | Behavior |
|---|---|
| **Mines** | Slow drift; 1 HP; contact damages hull |
| **Mantas** | Chase the sub; multi-hit |
| **Swarm** | Fast chasers; low HP |
| **Shipwrecks** | Slow obstacles; torpedo for points |
| **Beacons** | Slow; high score when destroyed |
| **Seafloor** | Slow terrain pieces |

Spawn mix is weighted in admin (**Gameplay Tuning → Spawn Weights**).

---

## Gameplay defaults (admin → Gameplay Tuning)

Authoritative defaults live in `src/lib/gameConfig.ts` (`DEFAULT_GAMEPLAY_SETTINGS`). The DB `gameplay_settings` JSONB is merged and validated with Zod on every read/write. Reset to these values from the admin **Reset to Defaults** button.

### Submarine & battery

| Field | Default | Notes |
|-------|---------|--------|
| `lives` | 3 | Respawns before game over |
| `max_hp` | 5 | Hull per life |
| `thrust` | 240 | Acceleration |
| `rotation_speed` | 3.2 | rad/s |
| `friction` | 0.985 | Velocity damping |
| `sub_radius` | 20 | Hitbox px |
| `respawn_invincibility` | 2.5 | Seconds |
| `battery_max` | 100 | |
| `battery_drain` | 3 | Per second while thrusting |
| `battery_recharge` | 5 | Per second idle |

### Torpedo & sonar

| Field | Default | Notes |
|-------|---------|--------|
| `torpedo_speed` | 420 | px/s |
| `torpedo_cooldown` | 0.22 | s |
| `torpedo_life` | 2.5 | s |
| `sonar_cooldown` | 6 | s |
| `sonar_duration` | 7 | s |
| `sonar_max_radius` | 600 | px |
| `sonar_fov_degrees` | 90 | ° |

### Waves & enemies

| Field | Default |
|-------|---------|
| `spawn_base_count` / `spawn_max_count` | 3 / 14 |
| `spawn_base_interval` / `spawn_min_interval` | 9 / 3.5 s |
| `spawn_interval_reduction` | 0.4 s per wave |
| `enemy_base_speed` / `enemy_speed_variance` / `enemy_wave_speed_bonus` | 25 / 35 / 4 |
| `mine_weight` … `seafloor_weight` | 0.30 / 0.25 / 0.20 / 0.10 / 0.10 / 0.05 |
| `mine_hp` … `seafloor_hp` | 1 / 3 / 1 / 2 / 2 / 2 |

### Scoring

| Field | Default |
|-------|---------|
| `score_mine` … `score_seafloor` | 150 / 400 / 100 / 50 / 200 / 75 |
| `depth_gain_base` / `depth_gain_variance` | 30 / 40 |

---

## 🏗️ Architecture

```
┌─────────────────┐     Supabase Realtime      ┌──────────────────┐
│   TV / Display   │◄──── Broadcast Channel ────►│  Phone Controller │
│   (/ route)      │     (session-specific)      │  (/controller)   │
└────────┬────────┘                              └──────────────────┘
         │
         │  Supabase DB
         ▼
┌─────────────────┐
│  game_sessions   │  Session tracking (TV + DB)
│  game_scores     │  Leaderboard (+ optional session_id FK)
│  game_config     │  Branding, toggles, gameplay_settings JSONB
│  player_registrations │ Booth lead capture (controller form)
│  admin_users     │  Allowlisted operators
└─────────────────┘
         ▲
         │
┌────────┴────────┐
│   Admin Panel    │  Service-role writes; React Query config
│   (/admin)       │
└─────────────────┘
```

### Tech Stack

- **Frontend:** React 19 + TanStack Start + TanStack Router + React Query
- **Realtime:** Supabase private Broadcast channels (`abyssal_session_{CODE}`) with RLS on `realtime.messages`
- **Database:** Supabase PostgreSQL + Zod-validated `game_config`
- **Game logic:** `src/game/` (state, update, render) + thin `SubmarineGame.tsx`
- **Rendering:** HTML5 Canvas
- **Deploy:** Lovable / Cloudflare Workers (see [docs/Deployment.md](docs/Deployment.md))

### Communication Flow

1. TV creates channel `abyssal_session_{6-char}` and a 32-char **join token** (in QR only)
2. Phone opens `/controller?session=&token=` and sends `player_joined` with the token
3. TV validates token, sends `game_ack`, or `session_busy` if another player is active
4. Phone sends `controller_input` on change or every **2s heartbeat**; TV tracks link loss (~10s) and idle (~30s)
5. TV drives Canvas from merged remote + local input; on game over sends `game_over` and persists score
6. `player_left`, tab close, or timeouts return TV to waiting lobby and **rotate the join token**

---

## 📊 Database Tables

### `game_sessions`
| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `session_code` | TEXT | 6-character session identifier |
| `player_name` | TEXT | In-game display name |
| `status` | TEXT | `waiting` / `playing` / `ended` |
| `created_at` | TIMESTAMP | Session creation time |
| `started_at` | TIMESTAMP | When player joined |
| `ended_at` | TIMESTAMP | When game ended |

### `game_scores`
| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `session_code` | TEXT | Links to session |
| `player_name` | TEXT | In-game display name |
| `score` | INTEGER | Final score |
| `depth` | INTEGER | Max depth reached |
| `wave` | INTEGER | Last wave survived |
| `created_at` | TIMESTAMP | Score timestamp |

### `game_config` (single row)
| Column | Type | Description |
|---|---|---|
| `game_name`, `title`, `subtitle` | TEXT | TV / controller branding |
| `mission_description` | TEXT | Waiting-screen briefing |
| `controller_header`, `controller_footer` | TEXT | Phone chrome |
| `footer_text` | TEXT | Global footer when enabled |
| `show_*` | BOOLEAN | Logo, QR, mission, share, footer toggles |
| `umami_website_id`, `umami_script_url` | TEXT | Optional analytics |
| `gameplay_settings` | JSONB | Tuning object — defaults in [gameplay table](#gameplay-defaults-admin--gameplay-tuning) |

### `player_registrations`
| Column | Type | Description |
|---|---|---|
| `first_name`, `last_name`, `company`, `email` | TEXT | Booth registration (PII) |
| `session_code` | TEXT | Booth session when registered |
| `gdpr_consent` | BOOLEAN | Required to play |

---

## 🚀 Quick Setup for Events

1. Complete **[Setup](docs/Setup.md)** and **[Deployment](docs/Deployment.md)** once (Supabase, env vars, migrations, admin users).
2. Open the **production** game URL on a large display / TV (not localhost).
3. Sign in at `/admin` → **BRANDING** → customize for your company.
4. TV shows QR + session code — visitors scan and play.
5. Monitor **SESSIONS**, **SCOREBOARD**, and **LEADS** in admin.

---

## 📚 Documentation

| Guide | Description |
|-------|-------------|
| [docs/Setup.md](docs/Setup.md) | Prerequisites, dependencies, Supabase, local dev |
| [docs/Deployment.md](docs/Deployment.md) | Hosting, env vars, admin operators, event checklist |
| [docs/solution-design.md](docs/solution-design.md) | Architecture and technical design |
| [docs/improvement-report.md](docs/improvement-report.md) | Security and quality backlog |
| [docs/Stack-Comparison-Supabase-vs-Cloudflare.md](docs/Stack-Comparison-Supabase-vs-Cloudflare.md) | Supabase vs full Cloudflare backend (features, price, limits) |
| [docs/Deploy-Cloudflare-Workers-Builds.md](docs/Deploy-Cloudflare-Workers-Builds.md) | Workers Builds vs GitHub Actions (replace deploy CI) |
| [docs/Browser-Console.md](docs/Browser-Console.md) | Console noise (extensions vs app), `VITE_LOG_LEVEL` |

---

## 📝 Notes

- **Players** use the QR link only — no Supabase login; registration is lead capture (PII stored in `player_registrations`)
- **Operators** sign in at `/admin` with Supabase Auth (see Deployment doc)
- **Scores** persist via server-validated `submitGameScore` (not direct client INSERT); global leaderboard is **exhibition** — caps tied to gameplay settings, one score per session
- TV game-over HUD also keeps top 10 in `localStorage`
- **Multiple TVs** = independent session codes + join tokens per browser tab
- **Admin sessions/scores** refresh on an interval; **game_config** refreshes via React Query + Realtime invalidation
- Regenerate TypeScript DB types after schema changes: `npm run gen:types`
