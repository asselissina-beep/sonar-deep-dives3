# Production deployment checklist — ABYSSAL

Use this document for **go-live validation** before and during booth events. It consolidates [Setup.md](./Setup.md), [Deployment.md](./Deployment.md), and [Cloudflare-Deploy.md](./Cloudflare-Deploy.md) into actionable checklists.

**Last validated against codebase:** 2026-05-18

---

## Solution validation summary

### Ready for production (core booth flow)

| Area | Status | Notes |
|------|--------|--------|
| TV game + Canvas | ✅ | `/` — session code, QR with join token, gameplay |
| Phone controller + registration | ✅ | First/last name, company, work email, GDPR |
| Realtime input | ✅ | Private Broadcast channels, 6-char sessions, join-token validation on TV |
| Score / session persistence | ✅ | Server functions (`startGameSession`, `submitGameScore`) + service role; score bounds validated |
| Admin panel | ✅ | Supabase Auth + `admin_users`; branding/gameplay saves via service role |
| Public scoreboard | ✅ | `/scoreboard` reads `game_scores` |
| Database migrations | ✅ | Security migrations through `20260517120000` (`company` on registrations) |
| Build / CI | ✅ | `npm run lint`, `npm test`, `npm run build` |
| Env-based public URL | ✅ | `VITE_APP_ORIGIN` for QR / SEO (no hardcoded `lovable.app` in app code) |

### Gaps / follow-ups (not blockers for a single booth, but plan for them)

| Gap | Impact | Mitigation |
|-----|--------|------------|
| **No rate limiting** on registrations or score APIs | Abuse / spam at scale | Monitor Supabase logs; add edge rate limits or CAPTCHA if needed ([improvement-report.md](./improvement-report.md) §15) |
| **Booth server functions unauthenticated** | Forged scores if `sessionId` leaked via public session SELECT | See [improvement-report.md](./improvement-report.md) §19; low risk at single booth |
| **GDPR retention** not automated | PII accumulates | Define retention policy; purge `player_registrations` post-event |
| **Join token not bound** to score submit | Theoretical cross-session score attach | Low risk at booth; join token protects Realtime join |
| **`.env` may still be git-tracked** | Secret leak risk if ever committed with real keys | Run `git rm --cached .env`; rotate keys if pushed |
| **`ADMIN_BOOTSTRAP_EMAILS` on Cloudflare** | Bootstrap sign-in fails if secret missing | Set Wrangler secret (see §2.2) or use SQL / `app_metadata.role` |
| **E2E tests** | No Playwright/Cypress booth flow | Rely on manual smoke test below |
| **i18n** | English-only UI | Acceptable for single-locale events |

### Architecture (quick reference)

```text
TV (/)  ──Realtime Broadcast──►  Phone (/controller?session=&token=)
  │                                      │
  └── Server functions ────────────────┘
         (scores/sessions/admin)
                    │
                    ▼
              Supabase (Postgres + Auth + Realtime)
```

---

## 1. One-time: Supabase (database)

- [ ] Production project created in region close to the event
- [ ] `supabase link --project-ref <ref>` and `supabase db push` — all migrations apply cleanly
- [ ] **Table Editor:** `game_config` (seed row), `game_sessions`, `game_scores`, `player_registrations` (includes **`company`**), `admin_users`
- [ ] **Realtime → Settings:** **Allow public access** = **disabled**
- [ ] **Authentication → Providers:** Email enabled
- [ ] **Authentication → Users:** At least one operator account created
- [ ] Admin access granted (one of):
  - [ ] `ADMIN_BOOTSTRAP_EMAILS` set on app host **and** operator email listed, then sign in once at `/admin`, or
  - [ ] User **App Metadata** `{ "role": "admin" }`, or
  - [ ] `INSERT INTO admin_users (user_id, email) SELECT id, email FROM auth.users WHERE email = '...'`
- [ ] Optional: disable public sign-up (operators only)
- [ ] GitHub secret `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` for [supabase-migrate.yml](../.github/workflows/supabase-migrate.yml) (if using CI migrations)

---

## 2. One-time: App hosting (Cloudflare Workers or Lovable)

### 2.1 Build-time variables (embedded in client bundle)

Set in CI secrets or local shell **before** `npm run build`:

- [ ] `VITE_SUPABASE_URL`
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY`
- [ ] `VITE_APP_ORIGIN` — **canonical HTTPS URL** phones will open (custom domain strongly recommended for booth Wi‑Fi)
- [ ] `VITE_OG_IMAGE_URL` (optional)

### 2.2 Runtime secrets (server / Worker)

- [ ] `SUPABASE_URL` (same project URL)
- [ ] `SUPABASE_PUBLISHABLE_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — **required** for admin saves, scores, sessions, registration export
- [ ] `ADMIN_BOOTSTRAP_EMAILS` (optional) — e.g. `ops@yourcompany.com` — **Cloudflare:** `npx wrangler secret put ADMIN_BOOTSTRAP_EMAILS`

**Cloudflare GitHub Actions** ([deploy-cloudflare.yml](../.github/workflows/deploy-cloudflare.yml)) also needs:

- [ ] `CLOUDFLARE_API_TOKEN`
- [ ] `CLOUDFLARE_ACCOUNT_ID`

### 2.3 Deploy

- [ ] `npm ci && npm run lint && npm test && npm run build` succeeds locally with production env
- [ ] Deploy: Lovable publish **or** `npx wrangler deploy` **or** push to `main` (if CI deploy enabled)
- [ ] After workflow-only changes: run deploy via **Actions → Deploy Cloudflare → Run workflow** (deploy ignores `.github/**` path-only pushes)

### 2.4 Custom domain & TLS (recommended)

- [ ] Custom domain attached (e.g. `game.yourcompany.com`) — **Active** in Cloudflare
- [ ] `VITE_APP_ORIGIN` matches that domain; **rebuild and redeploy** after changing it
- [ ] TV opened at `https://<canonical-host>/` (not staging, not bare `workers.dev` if phones showed cert errors)

---

## 3. Pre-event smoke test (≈15 minutes)

Run on **production** URL with one laptop (TV) and one phone.

### Admin

- [ ] Open `/admin` → sign in with operator account
- [ ] **Branding:** change game name → save → reload → value persists
- [ ] **Gameplay** (optional): tweak one numeric field → save

### TV + phone flow

- [ ] Open `/` on TV (production host)
- [ ] QR displays URL with `session=` (6 chars) and `token=` (32 hex chars)
- [ ] Phone scans QR — **no** TLS certificate warning
- [ ] Registration: first name, last name, company, work email, GDPR → **Engage**
- [ ] TV accepts player; game starts (or tap **DIVE** on mobile TV)
- [ ] Play until game over (≥8 seconds for score validation)
- [ ] Score appears on `/scoreboard`
- [ ] Phone can **Resurface** (up to 3 dives) or exit; TV returns to lobby with **new** QR token

### Network

- [ ] Venue Wi‑Fi allows HTTPS and WSS to `*.supabase.co`
- [ ] Optional: test on guest Wi‑Fi / mobile data (same as attendees)

---

## 4. Booth day checklist

- [ ] TV: fullscreen browser, production URL bookmarked, screen never sleeps
- [ ] `VITE_APP_ORIGIN` / TV URL match (QR points to trusted host)
- [ ] Operator knows `/admin` credentials
- [ ] Backup: printed short URL + session code **only if** QR fails (full URL with `token` still required — do not share token publicly)
- [ ] Monitor: Supabase dashboard (Realtime connections, API errors) if traffic is high

---

## 5. After event (optional)

- [ ] Export leads: call `fetchPlayerRegistrations` (admin-authenticated) or SQL on `player_registrations`
- [ ] Clear sessions/scores from admin if desired
- [ ] Document GDPR: retention / deletion of `player_registrations`
- [ ] Rotate secrets if `.env` or service role was ever exposed

---

## 6. CI/CD path filters (awareness)

Pushes that change **only** these paths do **not** run app CI/deploy:

- `docs/**`, `docker/**`, `**/*.md`, `supabase/migrations/**` (migrations use separate workflow), etc.

After **migration-only** pushes: confirm `supabase-migrate` workflow ran. After **app** changes: confirm `deploy-cloudflare` ran or deploy manually.

---

## 7. Troubleshooting quick hits

| Symptom | Check |
|---------|--------|
| Admin save fails | `SUPABASE_SERVICE_ROLE_KEY` on host; redeploy |
| Registration fails | `company` migration applied; RLS INSERT policy |
| Phone cert error on `workers.dev` | Custom domain + `VITE_APP_ORIGIN` |
| Controller won’t link | Realtime public access off; fresh QR; firewall |
| No score on board | Full game length; service role; server logs |
| Admin “not authorized” | `admin_users` row or bootstrap email / metadata |

Full tables: [Deployment.md §10](./Deployment.md#10-troubleshooting) · [Cloudflare-Deploy.md](./Cloudflare-Deploy.md)

---

## 8. Related documents

| Doc | Use when |
|-----|----------|
| [Setup.md](./Setup.md) | First local install |
| [Deployment.md](./Deployment.md) | Provider comparison, env reference |
| [Cloudflare-Deploy.md](./Cloudflare-Deploy.md) | Wrangler + GitHub Actions detail |
| [solution-design.md](./solution-design.md) | Architecture deep dive |
| [improvement-report.md](./improvement-report.md) | Security status & backlog |
| [issues.md](./issues.md) | Scanner findings snapshot |
