# Deploy ABYSSAL to Cloudflare Workers — step-by-step manual

This guide walks through deploying the **web app** to **Cloudflare Workers** with **Supabase** as the database, Auth, and Realtime backend. It includes a **price prediction** for typical booth/event traffic.

**Related docs:** [Setup.md](./Setup.md) (local env) · [Deployment.md](./Deployment.md) (all providers) · [`.env.example`](../.env.example)

**Pricing sources (verify before budgeting):**

- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Supabase pricing](https://supabase.com/pricing) · [Realtime pricing](https://supabase.com/docs/guides/realtime/pricing)

---

## Architecture you are deploying

| Piece | Where it runs | Cost driver |
|-------|----------------|-------------|
| TanStack Start app (SSR + server functions) | **Cloudflare Workers** | HTTP requests, CPU ms |
| PostgreSQL, Auth, Realtime Broadcast | **Supabase Cloud** | Plan tier, peak Realtime connections, messages |
| DNS / TLS (optional custom domain) | **Cloudflare** (same account) | Domain registration (~annual) |

Realtime game input does **not** go through Workers — phones and the TV talk to Supabase Realtime directly. Workers handle pages, admin APIs, and validated score/session writes.

---

## Deploy button (Cloudflare)

For one-click provisioning via Cloudflare Workers Builds, use the repository deploy button:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/T-REX-XP/sonar-deep-dives)

This follows Cloudflare's Deploy Button flow and pre-fills the build/deploy commands from `package.json` (`build` + `deploy` scripts). After button setup, set required Supabase variables/secrets in the Cloudflare project config.

---

## Prerequisites checklist

Before you start, have:

- [ ] [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [ ] [Supabase account](https://supabase.com) and a project (note **project ref**)
- [ ] [Node.js](https://nodejs.org/) 20.19+ or 22.x and npm (or Bun)
- [ ] Git repo cloned locally
- [ ] Supabase CLI installed (`npm i -g supabase` or [install guide](https://supabase.com/docs/guides/cli/getting-started))

---

## Phase 1 — Supabase (database & Realtime)

Do this **before** the first Cloudflare deploy.

### Step 1.1 — Create or select a project

1. Open [Supabase Dashboard](https://supabase.com/dashboard).
2. **New project** → choose a **region close to the event** (e.g. EU West for European trade shows).
3. Save the database password.

### Step 1.2 — Apply migrations

From the repo root on your machine:

```bash
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
supabase db push
```

All files under `supabase/migrations/` must apply without errors.

**Verify:** Table Editor shows `game_config`, `game_sessions`, `game_scores`, `player_registrations` (with `company` column), `admin_users`, and a seed row in `game_config`.

### Step 1.3 — Configure Auth (admin)

1. **Authentication → Providers** → enable **Email**.
2. **Authentication → Users** → create an operator user (email + password) for `/admin`.
3. Optional: disable public sign-up if only pre-provisioned operators should log in.

Grant admin (pick one):

- Set `ADMIN_BOOTSTRAP_EMAILS=ops@yourcompany.com` in Cloudflare secrets (Phase 3), then sign in once at `/admin`, or
- User **App Metadata** → `{ "role": "admin" }`, or
- SQL: `INSERT INTO admin_users (user_id, email) SELECT id, email FROM auth.users WHERE email = '...';`

### Step 1.4 — Configure Realtime

1. **Project → Realtime → Settings**
2. **Disable “Allow public access”** (required for private Broadcast channels + RLS).
3. Confirm Realtime is enabled for the project.

### Step 1.5 — Copy API keys

**Project Settings → API:**

| Copy this | Use as |
|-----------|--------|
| Project URL | `VITE_SUPABASE_URL`, `SUPABASE_URL` |
| anon / publishable key | `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PUBLISHABLE_KEY` |
| service_role key | `SUPABASE_SERVICE_ROLE_KEY` (server only — never `VITE_*`) |

Store these in a password manager; you will paste them into Cloudflare in Phase 3.

---

## Phase 2 — Cloudflare account & Wrangler

### Step 2.1 — Log in to Cloudflare

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com).
2. Note your **Account ID** (Workers & Pages → overview, right sidebar).

### Step 2.2 — Install dependencies and build locally (smoke test)

```bash
cd sonar-deep-dives
npm install
```

Create `.env` from the template and fill Supabase values (for local build test):

```bash
cp .env.example .env
# Edit .env with your Supabase URL and keys
```

Build:

```bash
npm run build
```

If the build fails, fix env or TypeScript errors before deploying.

### Step 2.3 — Install / use Wrangler

Wrangler is bundled via the project (`npx wrangler`). Log in:

```bash
npx wrangler login
```

Browser opens; approve access for your Cloudflare account.

### Step 2.4 — (Optional) Name the Worker

Default name is in [`wrangler.jsonc`](../wrangler.jsonc): `tanstack-start-app`. To change it, edit:

```jsonc
{
  "name": "sonar-deep-dives",
  "compatibility_date": "2025-09-24",
  "compatibility_flags": ["nodejs_compat"],
  "main": "@tanstack/react-start/server-entry"
}
```

---

## Phase 3 — Environment variables & secrets

### Step 3.1 — Client variables (build time)

`VITE_*` values are **embedded at build time**. Set them in the shell (or CI) **before** `npm run build` / `wrangler deploy`.

| Variable | Example | Notes |
|----------|---------|--------|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | Public in browser bundle |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJ...` | Anon key; RLS applies |
| `VITE_APP_ORIGIN` | `https://game.yourcompany.com` | **Required for booth QR** if TV and phones should use a custom domain or fixed Workers URL (build-time) |
| `VITE_OG_IMAGE_URL` | `https://cdn.example/og.png` | Optional social preview image |

**PowerShell (one deploy session):**

```powershell
$env:VITE_SUPABASE_URL = "https://YOUR_REF.supabase.co"
$env:VITE_SUPABASE_PUBLISHABLE_KEY = "YOUR_ANON_KEY"
```

**bash:**

```bash
export VITE_SUPABASE_URL=https://YOUR_REF.supabase.co
export VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_ANON_KEY
```

### Step 3.2 — Server secrets (runtime)

Set via Wrangler (not in git):

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
```

Paste each value when prompted.

Optional:

```bash
npx wrangler secret put ADMIN_BOOTSTRAP_EMAILS
# e.g. ops@yourcompany.com
```

**Verify secrets:**

```bash
npx wrangler secret list
```

---

## Phase 4 — Deploy to Cloudflare Workers

### Step 4.1 — Production deploy

With `VITE_*` exported (Step 3.1):

```bash
npm run build
npx wrangler deploy
```

Wrangler prints a URL like:

`https://sonar-deep-dives.<your-subdomain>.workers.dev`

### Step 4.2 — Post-deploy smoke test

| # | Action | Expected |
|---|--------|----------|
| 1 | Open `https://<worker-url>/` | Waiting screen / game UI |
| 2 | Open `/admin` | Login form; sign in works |
| 3 | Save a branding field in admin | Success (needs service role secret) |
| 4 | Scan QR or open `/controller?...` on phone | Registration → game_ack |
| 5 | Finish a dive (≥8 s) | Score on `/scoreboard` |
| 6 | Supabase → Logs | No repeated 401/500 on server functions |

### Step 4.3 — Tail logs (debugging)

```bash
npx wrangler tail
```

Reproduce an issue; watch Worker exceptions and `console` output.

---

## Phase 5 — Custom domain (recommended for booths)

### Step 5.1 — Add domain to Cloudflare

1. Add your zone in Cloudflare (or transfer DNS).
2. **Workers & Pages** → your Worker → **Settings** → **Domains & Routes**.
3. **Add** → Custom domain, e.g. `game.yourcompany.com`.

### Step 5.2 — DNS

Cloudflare usually creates the required DNS records automatically. Wait for **Active** status.

### Step 5.3 — Booth rule

Open the **TV** at `https://game.yourcompany.com/` (recommended). Set `VITE_APP_ORIGIN` to that URL before build/deploy so QR links match even if you preview on `workers.dev`. Wrong host or HTTP certificate errors on phones = broken controller links (see troubleshooting below).

---

## Phase 6 — CI/CD (GitHub Actions or Workers Builds)

**Choosing a pipeline:** See [Deploy-Cloudflare-Workers-Builds.md](./Deploy-Cloudflare-Workers-Builds.md) for replacing the deploy workflow with **Cloudflare Workers Builds** (dashboard Git integration), comparison with GitHub Actions, and the recommended **hybrid** setup for this project.

Workflows in [`.github/workflows/`](../.github/workflows/):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| **`ci.yml`** | PR + push to `main` | Lint, unit tests, production build |
| **`deploy-cloudflare.yml`** | Push to `main`, manual | Build + `wrangler deploy` |
| **`supabase-migrate.yml`** | Migration SQL on `main`, manual | `supabase db push` |

### Step 6.1 — Cloudflare API token

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **My Profile** → **API Tokens** → **Create Token**.
2. Use template **Edit Cloudflare Workers** or custom permissions:
   - Account → **Workers Scripts** → Edit
   - Account → **Account Settings** → Read
3. Copy the token → GitHub secret `CLOUDFLARE_API_TOKEN`.
4. Copy **Account ID** (Workers overview) → GitHub secret `CLOUDFLARE_ACCOUNT_ID`.

### Step 6.2 — GitHub repository secrets

**Settings → Secrets and variables → Actions → New repository secret:**

| Secret | Used by | Value |
|--------|---------|--------|
| `CLOUDFLARE_API_TOKEN` | Deploy | API token from Step 6.1 |
| `CLOUDFLARE_ACCOUNT_ID` | Deploy | Cloudflare account ID |
| `VITE_SUPABASE_URL` | Build + deploy | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Build | Supabase anon / publishable key |
| `VITE_APP_ORIGIN` | Build | Public HTTPS origin for QR / SEO |
| `VITE_OG_IMAGE_URL` | Build | Optional OG image URL |
| `SUPABASE_URL` | Worker runtime | Same as `VITE_SUPABASE_URL` |
| `SUPABASE_PUBLISHABLE_KEY` | Worker runtime | Same as anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker runtime | Service role key (never `VITE_*`) |
| `ADMIN_BOOTSTRAP_EMAILS` | Worker runtime (optional) | Comma-separated emails for first `/admin` sign-in |

Optional (migrations workflow):

| Secret | Purpose |
|--------|---------|
| `SUPABASE_ACCESS_TOKEN` | [Supabase CLI token](https://supabase.com/dashboard/account/tokens) |
| `SUPABASE_PROJECT_REF` | Project ref from dashboard URL |
| `SUPABASE_DB_PASSWORD` | Database password |

Optional Worker secret (set once in Cloudflare dashboard if not in CI):

| Secret | Purpose |
|--------|---------|
| `ADMIN_BOOTSTRAP_EMAILS` | Comma-separated admin emails for first `/admin` sign-in |

### Step 6.3 — First automated deploy

1. Push to `main` (or **Actions → Deploy Cloudflare → Run workflow**).
2. Open the workflow run; confirm **Deploy to Cloudflare Workers** succeeds.
3. Open the Workers URL from the log or Cloudflare dashboard.

### Step 6.4 — Optional: protect production

Create a GitHub **Environment** named `production` with required reviewers, then add `environment: production` to the deploy job in `deploy-cloudflare.yml`.

---

## Price prediction

Estimates below are **order-of-magnitude** for planning. Confirm on official pricing pages before purchase orders. Assumes **USD**, monthly billing unless noted.

### What drives cost for this app

| Service | Driver | ABYSSAL pattern |
|---------|--------|------------------|
| **Cloudflare Workers** | Billable HTTP requests to the Worker; CPU time per SSR/server function | Page loads, `/admin` API, `startGameSession` / `submitGameScore` |
| **Cloudflare Workers** | Static asset requests | **Free & unlimited** (JS/CSS from build) |
| **Supabase** | Plan base fee | Postgres + Auth |
| **Supabase Realtime** | **Peak concurrent connections** | ~1 per TV + ~1 per active phone (+ occasional scoreboard tab) |
| **Supabase Realtime** | **Messages** | Controller ~**20 msgs/s** while inputs change; heartbeats ~0.5/s when idle |

Realtime traffic does **not** count as Cloudflare Worker requests.

### Traffic model (booth)

Use this worksheet:

| Input | Symbol | Example (medium booth) |
|-------|--------|-------------------------|
| Event days | D | 3 |
| Players per day | P | 400 |
| Avg active play time | T | 4 min (240 s) |
| Concurrent TVs | TV | 1 |
| Avg concurrent players | C | 2 (queue rarely >2 on one TV) |
| Dynamic Worker requests per player journey | R | 12 (SSR pages + 2–3 server functions) |

**Derived:**

- **Worker requests (month)** ≈ `P × D × R` → 400 × 3 × 12 = **14,400** (very low)
- **Realtime peak connections** ≈ `TV + C + buffer` → **~5–15** typical single booth
- **Realtime messages (event)** ≈ `P × T × 20` (upper bound, all input active) → 400 × 3 × 240 × 20 ≈ **5.8M** messages (many booths see less due to idle heartbeats only)

### Scenario A — Pilot / single TV, small event

| | |
|--|--|
| **Profile** | 1 TV, 1–2 days, ~80 players/day, mostly on free tiers |
| **Cloudflare** | **$0** on Workers Free (100k requests/day >> need) |
| **Supabase** | **$0** on Free if peak connections & message quotas stay within [Free limits](https://supabase.com/pricing) |
| **Domain** | **$0** if using `*.workers.dev` only |
| **Estimated total** | **$0 / month** (pilot only; watch Supabase quotas) |

**Risk:** Free tier Realtime / MAU limits; upgrade before a busy public show.

### Scenario B — Production booth (recommended)

| | |
|--|--|
| **Profile** | 1 TV, 3-day trade show, 300–500 players/day, admin tuning live |
| **Cloudflare Workers Paid** | **$5 / month** minimum (includes 10M requests + 30M CPU-ms) — you will likely stay at minimum |
| **Supabase Pro** | **$25 / month** base (8 GB DB, 500 peak Realtime connections, 5M Realtime messages included) |
| **Overages** | Usually **$0** at this scale (connections ≪ 500, messages often &lt; 5M) |
| **Custom domain** | **~$10–15 / year** if registering through Cloudflare |
| **Estimated total** | **~$30–35 / month** for the event month |

### Scenario C — High-traffic or multi-TV

| | |
|--|--|
| **Profile** | 3 TVs, same Supabase project, 800 players/day, 5 days |
| **Cloudflare** | Still **~$5–8 / month** (unless viral web traffic; SSR stays small) |
| **Supabase Pro** | **$25** base; peak connections ~10–25 → still within 500 |
| **Realtime messages** | Up to ~15M for heavy play → **~$1** overage above 5M included ($0.10 / million) |
| **Estimated total** | **~$35–45 / month** |

### Scenario D — Worst-case stress (planning ceiling)

| | |
|--|--|
| **Profile** | 10 TVs, 2,000 players/day, long plays, many scoreboard kiosks |
| **Cloudflare** | **$5–15** (still modest unless millions of SSR hits) |
| **Supabase** | **$25** + possible **$10+** per extra 1,000 peak connections if you exceed 500 sustained |
| **Estimated total** | **$50–120+ / month** — contact Supabase sales / Team plan if sustained &gt;500 peak connections |

### Cost summary table

| Scenario | Cloudflare Workers | Supabase | Domain (yr) | **Est. monthly** |
|----------|-------------------|----------|-------------|------------------|
| A — Pilot | $0 | $0 | $0 | **$0** |
| B — Standard booth | $5 | $25 | ~$1 amortized | **~$30–35** |
| C — Multi-TV busy | $5–8 | $26–28 | ~$1 | **~$35–45** |
| D — Stress | $5–15 | $50–100+ | ~$1 | **$50–120+** |

### What is *not* a major cost here

- **Bandwidth / egress** on Cloudflare Workers: no egress fees on standard Workers pricing.
- **Per-player Cloudflare cost**: static assets are free; game loop runs in the browser.
- **Umami analytics** (optional): self-hosted $0 or Umami Cloud separate product.

### Lovable Cloud alternative

If the project is published via [Lovable](https://lovable.dev), hosting may be bundled in a **Lovable subscription** (pricing varies by plan). You still pay **Supabase** separately. Use Lovable’s env UI instead of Wrangler secrets; the Supabase cost scenarios above still apply.

---

## Pre-event checklist (Cloudflare + Supabase)

- [ ] Migrations applied: `supabase db push`
- [ ] Realtime public access **disabled**
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set in Wrangler secrets
- [ ] `VITE_SUPABASE_*` set at last production build
- [ ] Custom domain active; TV uses production URL
- [ ] Admin sign-in and config save tested
- [ ] One full play: phone → TV → score on `/scoreboard`
- [ ] Venue Wi-Fi allows WebSockets to `*.supabase.co`

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Console **React #418** / hydration error | Text mismatch between SSR and client. TV: session/QR generated **after mount**. Scoreboard: loader-stable `gameName` + `ClientOnly` table (dates/scores). Redeploy latest `main`. See [react.dev/errors/418](https://react.dev/errors/418). |
| **500** on `/`, console **`Invalid API key`** | Wrong or missing Supabase keys in **GitHub Actions secrets** and/or **Wrangler secrets**. Use the **anon / publishable** key for `VITE_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_PUBLISHABLE_KEY` — never `service_role`. Re-copy from Supabase → **Project Settings → API**, update all secrets, then **re-run Deploy Cloudflare** (must rebuild for `VITE_*`). |
| **Missing Supabase URL or anon key** with build vars already set | **Deploy command ran a second build without `VITE_*`.** Set **Build** = `bun run build`, **Deploy** = `bun run deploy` (or `npx wrangler deploy`) where `deploy` is **`wrangler deploy` only** — not `npm run build && wrangler deploy`. Then **Retry deployment**. |
| Build OK, blank site | Rebuild with `VITE_SUPABASE_*` set |
| Admin save fails | `SUPABASE_SERVICE_ROLE_KEY` secret missing → `wrangler secret put` + redeploy |
| Controller won’t connect | Realtime settings; venue firewall; not localhost on TV |
| Scores missing | Service role; game ≥8 s; check `wrangler tail` / Supabase logs |
| `workers.dev` works, domain fails | DNS not proxied / route not attached to Worker |
| Phone shows `NET::ERR_CERT_*` on `workers.dev` | Prefer custom domain; set `VITE_APP_ORIGIN`; try another browser/network; see [Deployment.md §6](./Deployment.md#6-custom-domain-and-https) |

---

## Quick command reference

```bash
# One-time
npx wrangler login
supabase link --project-ref <ref>
supabase db push
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY

# Each release
export VITE_SUPABASE_URL=...
export VITE_SUPABASE_PUBLISHABLE_KEY=...
npm run build
npx wrangler deploy

# Ops
npx wrangler tail
npx wrangler secret list
```

---

*Last updated: 2026-05-15. Pricing links above are authoritative; revise estimates when vendors change plans.*
