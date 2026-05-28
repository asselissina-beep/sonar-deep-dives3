# Improvement Report — ABYSSAL (Sonar Deep Dives)

This report summarizes findings from repository analysis (application code, Supabase migrations, [issues.md](./issues.md)). Items are ordered by **impact**. **Re-verified against source:** 2026-05-18 (migrations through `20260518140000`, Workers deploy, Leads admin, session-break UX).

**Legend:** ✅ Completed · 🔶 Partially completed · ⬜ Open

---

## Status overview

| # | Item | Status |
|---|------|--------|
| 1 | Remove public DELETE on sessions/scores | ✅ Completed |
| 2 | Remove public UPDATE/INSERT on `game_config` | ✅ Completed |
| 3 | Harden `player_registrations` | 🔶 Partially completed |
| 4 | Replace shared PIN with real admin auth | ✅ Completed |
| 5 | Authorize / harden Realtime channels | ✅ Completed |
| 6 | Fix silent failure on score/session writes | ✅ Completed |
| 7 | Admin panel error handling | ✅ Completed |
| 8 | Session lifecycle edge cases | ✅ Completed |
| 9 | Decompose `SubmarineGame.tsx` | ✅ Completed |
| 10 | Add automated tests | ✅ Completed |
| 11 | Unify configuration loading | ✅ Completed |
| 12 | Type safety and schema sync | ✅ Completed |
| 13 | README and docs drift | ✅ Completed |
| 14 | Score cheating | ✅ Completed |
| 15 | Rate limiting and abuse | ⬜ Open |
| 16 | Performance at scale | ✅ Completed |
| 17 | Deployment and secrets | ✅ Completed |
| 18 | Accessibility and i18n | ⬜ Open |
| 19 | Booth persistence API hardening | ⬜ Open |
| 20 | GDPR retention and privacy ops | ⬜ Open |

**Security scan ([issues.md](./issues.md)):** Items 1–5 fixed in migrations `20260515120000`–`20260515120500`. Item 6 (permissive RLS) **partially fixed** in `20260515120600` — public `SELECT` on sessions/scores/config remains by design; see [§ Remaining database linter findings](#remaining-database-linter-findings) and [§19](#19-booth-persistence-api-hardening--open).

---

## Executive summary

The booth architecture remains sound: **Canvas on the TV**, **Realtime Broadcast for input**, **Postgres for persistence**. **P0 database security** (public DELETE, config writes, registration PII grants, Realtime broadcast RLS) is largely addressed in code and migrations. **Admin writes** require `SUPABASE_SERVICE_ROLE_KEY`; anon fallback removed from `admin.server.ts`.

Remaining priorities: **rate limiting**, **restrict or protect booth server functions** (`startGameSession` / `submitGameScore` are public POSTs today), and **GDPR retention** for `player_registrations`.

| Priority | Theme | Status |
|----------|-------|--------|
| P0 | Database RLS and admin writes | ✅ Done |
| P1 | Realtime channel trust | ✅ Core done (6-char codes, join token on TV/Realtime) |
| P1 | Booth API + session row exposure | ⬜ Open ([§19](#19-booth-persistence-api-hardening--open)) |
| P1 | Admin UX resilience | ✅ Done |
| P2 | Code structure and testing | 🔶 Unit tests done; E2E open |
| P2 | Score integrity (validated writes) | ✅ Done ([§14](#14-score-cheating--completed)) |
| P3 | Product and compliance polish | Ongoing |

---

## P0 — Security and data integrity

### 1. Remove public DELETE on sessions and scores — ✅ Completed

**Original finding:** Migrations granted `DELETE` with `USING (true)` on `game_sessions` and `game_scores`.

**Done:**

- Migration [`20260515120000_revoke_public_delete_sessions_scores.sql`](../supabase/migrations/20260515120000_revoke_public_delete_sessions_scores.sql) drops public DELETE policies.
- [`src/lib/admin.server.ts`](../src/lib/admin.server.ts) — `clearAllSessions` / `clearAllScores` use `getServiceRoleSupabase()` only.

**Verify after deploy:** `supabase db push`; confirm anon client cannot delete rows.

---

### 2. Remove public UPDATE (and INSERT) on `game_config` — ✅ Completed

**Original finding:** Anonymous clients could update branding, `gameplay_settings`, and Umami URLs.

**Done:**

- Migration [`20260515120100_revoke_public_write_game_config.sql`](../supabase/migrations/20260515120100_revoke_public_write_game_config.sql) drops public INSERT/UPDATE policies.
- `updateConfigInDb` uses service role only; anon fallback removed from `getAdminSupabase()`.

**Verify:** Admin branding save works only when `SUPABASE_SERVICE_ROLE_KEY` is set on the host.

---

### 3. Harden `player_registrations` — ✅ Completed (security); compliance ops open

**Original finding:** PII table needed explicit read protection and admin export path.

**Done:**

- Migration [`20260515120200_lock_down_player_registrations.sql`](../supabase/migrations/20260515120200_lock_down_player_registrations.sql) — `REVOKE ALL` + `GRANT INSERT` only for `anon`/`authenticated`; table comment documents intent.
- Auth-gated [`fetchPlayerRegistrations`](../src/lib/adminServer.ts) + paginated [`listPlayerRegistrationsPage`](../src/lib/admin.server.ts) (service role).
- Migrations [`20260517120000`](../supabase/migrations/20260517120000_player_registrations_company.sql), [`20260518140000`](../supabase/migrations/20260518140000_drop_player_registrations_call_sign.sql) — `company` column; `call_sign` removed.
- [`RemoteController.tsx`](../src/components/RemoteController.tsx) — INSERT only, no `.select()`.
- Admin **Leads** page — table + CSV/JSON export ([`LeadsSection.tsx`](../src/components/admin/LeadsSection.tsx)).

**Compliance still open** (see [§20](#20-gdpr-retention-and-privacy-ops--open)): retention schedule, operator privacy notice, optional field minimization.

---

### 4. Replace shared PIN with real admin auth — ✅ Completed

**Original finding:** Shared `ADMIN_PIN` sent on every admin server call.

**Done:**

- Supabase Auth email/password on [`AdminPanel.tsx`](../src/components/AdminPanel.tsx).
- [`requireAdminAuth`](../src/integrations/supabase/admin-auth-middleware.ts) middleware on all admin server functions (Bearer JWT + `admin_users` / `app_metadata.role`).
- [`admin_users`](../supabase/migrations/20260515120400_admin_auth.sql) allowlist table + `ADMIN_BOOTSTRAP_EMAILS` env for first-time operator setup.
- [`src/start.ts`](../src/start.ts) registers `attachSupabaseAuth` for server function RPCs.
- PIN removed from server function inputs.

**Operator setup:** Create user in Supabase Authentication, then either set `app_metadata.role` to `"admin"` or insert into `admin_users`, or list email in `ADMIN_BOOTSTRAP_EMAILS` (comma-separated) on the host.

---

## P1 — Reliability and realtime

### 5. Authorize or harden Realtime Broadcast channels — ✅ Completed

**Original finding:** No `realtime.messages` RLS; arbitrary channel subscription; weak 3-char session codes.

**Done:**

- Migrations [`20260515120300`](../supabase/migrations/20260515120300_realtime_authorization.sql), [`20260515120500`](../supabase/migrations/20260515120500_realtime_session_code_length.sql) — RLS on `realtime.messages` for `abyssal_session_{6-char}` Broadcast topics only; `game_sessions` removed from realtime publication.
- [`gameChannel.ts`](../src/lib/gameChannel.ts) — `private: true` channels, **6-character** session codes (~1B combinations), **32-char join token** in QR (`?session=&token=`).
- TV validates `joinToken` on `player_joined` and `controller_input`; rotates token when returning to waiting lobby (new QR).
- Meaningful-input idle timeout + link-lost watchdog release stuck sessions ([`SESSION_INACTIVITY_MS`](../src/lib/gameChannel.ts), [`SESSION_LINK_LOST_MS`](../src/lib/gameChannel.ts)); see [§8](#8-session-lifecycle-edge-cases--completed).
- Phone shows **LINK EXPIRED** if no `game_ack` within 8s (stale QR).
- [`AdminPanel.tsx`](../src/components/AdminPanel.tsx) — polls sessions instead of postgres_changes on `game_sessions`.

**Ops:** Disable Realtime **“Allow public access”** in Supabase Dashboard ([Deployment.md](./Deployment.md)).

**Residual risk:** A player with a valid QR link can still control that booth session until the token rotates — by design for the event flow.

---

### 6. Fix silent failure on score and session writes — ✅ Completed

**Original finding:** Fire-and-forget Supabase writes on session start and game over could fail silently.

**Done:**

- [`gamePersistence.ts`](../src/lib/gamePersistence.ts) — `persistSessionStart` / `persistGameOver` with one retry (400ms), `appLog` on failure, `session_id` FK on scores, session end scoped by `id` when known.
- [`SubmarineGame.tsx`](../src/components/SubmarineGame.tsx) — awaits persistence on `player_joined` and game-over; amber TV warning when session/score save fails; local leaderboard still uses `localStorage`; game-over auto-return uses `returnToWaitingLobby()` (join token rotation).

---

### 7. Admin panel error handling — ✅ Completed

**Original finding:** Unhandled rejections could blank-screen admin on save failure.

**Done:** [`AdminPanel.tsx`](../src/components/AdminPanel.tsx) — `handlePinSubmit` / `handleConfigUpdate` use `try/catch`; editor components (`BrandingEditor`, etc.) catch save errors and show inline `⚠` messages without crashing.

---

### 8. Session lifecycle edge cases — ✅ Completed

**Original finding:** Phone killed without `player_left` left the TV in `playing`; `session_busy` blocked the next player. The 30s inactivity timer never fired because the controller broadcast idle packets at 30fps.

**Done:**

- [`gameChannel.ts`](../src/lib/gameChannel.ts) — `isMeaningfulControllerInput`, `SESSION_LINK_LOST_MS` (10s), `CONTROLLER_HEARTBEAT_MS` (2s).
- [`SubmarineGame.tsx`](../src/components/SubmarineGame.tsx) — separate link-lost vs idle watchdogs; `player_left` validated by `joinToken`; `persistSessionAbort` when leaving mid-game.
- [`RemoteController.tsx`](../src/components/RemoteController.tsx) — send input only on change or heartbeat; `pagehide` / `beforeunload` / 3s `visibilitychange` → `player_left` (+ exit on background).

---

## P2 — Maintainability and quality

### 9. Decompose `SubmarineGame.tsx` — ✅ Completed

**Original finding:** ~1,450 lines mixing physics, spawn, render, networking, and React lifecycle.

**Done:** Game logic moved to [`src/game/`](../src/game/) (`types.ts`, `constants.ts`, `state.ts`, `update.ts`, `visibility.ts`, `render.ts`, `scoreboard.ts`, `index.ts`). [`SubmarineGame.tsx`](../src/components/SubmarineGame.tsx) (~575 lines) owns Realtime, persistence, canvas loop, and waiting UI only.

---

### 10. Add automated tests — ✅ Completed

**Original finding:** No `test` script in [`package.json`](../package.json).

**Done:**

- [Vitest](https://vitest.dev/) with [`vitest.config.ts`](../vitest.config.ts) and [`src/test/setup.ts`](../src/test/setup.ts) (Supabase client mock).
- `npm test` / `npm run test:watch` in [`package.json`](../package.json).
- Unit coverage: [`gameChannel.test.ts`](../src/lib/gameChannel.test.ts) (session codes, join tokens, controller helpers), [`scoreValidation.test.ts`](../src/lib/scoreValidation.test.ts), [`gameConfig.schema.test.ts`](../src/lib/gameConfig.schema.test.ts), [`state.test.ts`](../src/game/state.test.ts) (spawn weights via `pickObstacleKind`), [`scoreboard.test.ts`](../src/game/scoreboard.test.ts).

**Still open:** Playwright E2E on staging (optional).

---

### 11. Unify configuration loading — ✅ Completed

**Original finding:** `fetchGameConfig` (SSR), `useGameConfig` (client), and DB seed defaults could drift; each route fetched config independently.

**Done:**

- [`gameConfig.ts`](../src/lib/gameConfig.ts) — `DEFAULT_GAMEPLAY_SETTINGS`, `DEFAULT_GAME_CONFIG_FIELDS`, `parseGameConfigRow`, `mergeGameplaySettings` (single defaults + normalize).
- React Query — `gameConfigQueryKey`, shared `fetchGameConfig` queryFn; root + page loaders use `loadGameConfigForRoute` / `ensureQueryData`; [`router.tsx`](../src/router.tsx) wraps app in `QueryClientProvider`.
- [`useGameConfig.ts`](../src/hooks/useGameConfig.ts) — `useQuery` + `postgres_changes` on `game_config` + `refetchOnWindowFocus`; admin save calls `invalidateGameConfig`.

---

### 12. Type safety and schema sync — ✅ Completed

**Original finding:** Unsafe casts on config fetch; `gameplay_settings` JSONB was not validated at runtime.

**Done:**

- [`gameConfig.schema.ts`](../src/lib/gameConfig.schema.ts) — Zod schemas for `GameplaySettings`, full `GameConfig`, and admin `gameConfigUpdateSchema`; `parseGameplaySettings`, `parseGameConfigRow`, `parseGameConfigUpdates`.
- Fetch path uses `parseGameConfigFromRow` with `Tables<"game_config">` (no `as unknown as GameConfig`).
- Admin save validates via `parseGameConfigUpdates` in [`adminServer.ts`](../src/lib/adminServer.ts).
- Types exported from Zod (`z.infer`); defaults checked against schema at module load.
- `npm run gen:types` script for [`types.ts`](../src/integrations/supabase/types.ts) regeneration after migrations.

---

### 13. README and docs drift — ✅ Completed

**Original finding:** Root README outdated vs seven admin sections, registration flow, controls, and gameplay defaults.

**Done:**

- [`README.md`](../README.md) — admin sidebar table, `/scoreboard`, registration + session lifecycle, corrected controls (`Space` = sonar, `F` = torpedo), threat types, architecture, `game_config` / `player_registrations` columns, `gen:types` script.
- Controller registration UI — first/last name, company, work email, GDPR; responsive accessible form; `VITE_APP_ORIGIN` / `VITE_OG_IMAGE_URL` replace hardcoded `lovable.app` URLs.
- [Gameplay defaults table](../README.md#gameplay-defaults-admin--gameplay-tuning) aligned with `DEFAULT_GAMEPLAY_SETTINGS` in [`gameConfig.ts`](../src/lib/gameConfig.ts).
- [`docs/README.md`](./README.md) — index links to game modules and defaults section.

---

## P2 — Product, performance, and ops

### 14. Score cheating — ✅ Completed

**Original finding:** Anon clients could `INSERT` arbitrary rows into `game_scores` (and sessions) without gameplay validation.

**Done:**

- Migration [`20260515120600`](../supabase/migrations/20260515120600_lock_down_score_and_session_writes.sql) — revoke public `INSERT`/`UPDATE` on `game_sessions` and `INSERT` on `game_scores`; unique index on `game_scores.session_id`.
- [`gamePersistence.functions.ts`](../src/lib/gamePersistence.functions.ts) + [`gamePersistence.server.ts`](../src/lib/gamePersistence.server.ts) — service-role `startGameSession`, `submitGameScore`, `abortGameSession`.
- [`scoreValidation.ts`](../src/lib/scoreValidation.ts) — binds score to active session (code + player), min duration 8s, one score per session, caps derived from `gameplay_settings`.
- TV uses server functions via [`gamePersistence.ts`](../src/lib/gamePersistence.ts); leaderboard remains **exhibition** (not cryptographic anti-cheat).

---

### 15. Rate limiting and abuse — ⬜ Open

**Recommendations:**

- Cloudflare WAF / rate rules on Worker routes and Supabase API (registrations INSERT, booth server functions).
- Per-IP limits on `player_registrations` INSERT (Supabase edge function or Worker proxy).
- Optional Turnstile on controller registration form for public events.
- Monitor [`Production-Checklist.md`](./Production-Checklist.md) metrics (registrations/hour, failed score writes).

---

### 19. Booth persistence API hardening — ⬜ Open

**Finding (2026-05 re-verification):** [`gamePersistence.functions.ts`](../src/lib/gamePersistence.functions.ts) exposes `startGameSession`, `submitGameScore`, and `abortGameSession` as **unauthenticated** TanStack Start server functions (no `requireAdminAuth`). Validation is server-side and strong ([`scoreValidation.ts`](../src/lib/scoreValidation.ts)), but:

1. **Public `SELECT` on `game_sessions`** (policy `Anyone can read sessions`, `USING (true)`) exposes `id`, `session_code`, `player_name`, and `status` to any anon client.
2. Anyone who can call the Worker can POST a forged `submitGameScore` if they copy an active row’s `sessionId`, `sessionCode`, and `playerName` from that query.

**Join token** protects Realtime join and TV control ([`SubmarineGame.tsx`](../src/components/SubmarineGame.tsx)) but is **not** checked in [`submitValidatedScoreInDb`](../src/lib/gamePersistence.server.ts).

**Risk at a typical booth:** Low (obscure API, UUID session ids). **Risk at scale / targeted abuse:** Medium (scripted leaderboard spam or session griefing).

**Recommended mitigations (pick one or combine):**

| Approach | Effort | Effect |
|----------|--------|--------|
| Revoke anon `SELECT` on `game_sessions`; admin loads sessions via service-role server function only | Medium | Breaks direct Supabase polling unless admin uses API |
| Store `join_token_hash` on session at `startGameSession`; require token on score submit | Medium | Binds score to QR holder |
| Short-lived HMAC / booth secret in server function requests (TV env) | Low–medium | Blocks arbitrary cross-origin POSTs if verified |
| Rate limit + alert on `submitGameScore` / `startGameSession` | Low | Reduces blast radius |
| Restrict `game_sessions` SELECT to `status = 'ended'` only for public views | Low | Partial; does not hide active ids |

**Verify:** From browser devtools, run `supabase.from('game_sessions').select('*').eq('status','playing')` with anon key — if rows return, treat as known exposure until mitigated.

---

### 20. GDPR retention and privacy ops — ⬜ Open

**Recommendations:**

- Document booth privacy notice (what is collected, lawful basis, retention, contact).
- Post-event: export Leads → delete or archive `player_registrations` per policy.
- Optional: Supabase scheduled job or one-off SQL purge by `created_at`.
- Do not rely on client-side “delete” — table has no public DELETE (correct).

---

### 16. Performance at scale — ✅ Completed

**Original finding:** Controller broadcast ~30 Hz per active player.

**Done:**

- [`gameChannel.ts`](../src/lib/gameChannel.ts) — `CONTROLLER_MAX_INPUT_HZ` (20) and `CONTROLLER_INPUT_INTERVAL_MS` (50 ms); [`RemoteController.tsx`](../src/components/RemoteController.tsx) uses the shared interval instead of a hard-coded 33 ms loop.
- Route code splitting — [`admin.tsx`](../src/routes/admin.tsx) and [`scoreboard.tsx`](../src/routes/scoreboard.tsx) lazy-load [`AdminPanel`](../src/components/AdminPanel.tsx) and [`ScoreboardPage`](../src/components/ScoreboardPage.tsx) with [`RoutePageLoader`](../src/components/RoutePageLoader.tsx), keeping the TV (`/`) and controller bundles smaller.

---

### 17. Deployment and secrets — ✅ Completed

**Done:** [Deployment.md](./Deployment.md), [Setup.md](./Setup.md), [`.env.example`](../.env.example), README prerequisites/getting started, `.gitignore` for `.env`.

---

### 18. Accessibility and i18n — ⬜ Open

**Recommendations:** Controller `aria-label`s, touch targets, optional high-contrast theme; i18n if needed beyond branding fields.

---

## P3 — Nice-to-have enhancements

| Idea | Status |
|------|--------|
| Admin kill switch for stuck session | ✅ Completed |
| Export registrations CSV in admin UI | ✅ Completed (`/admin` → Leads: table + CSV/JSON export) |
| Webhook on high score | ⬜ Open |
| Offline mode | ⬜ Open |
| Session QR with logo overlay | ⬜ Open |
| Duplicate active session code detection | ⬜ Open |

---

## Remaining database linter findings

[issues.md](./issues.md) **item 6** (`SUPA_rls_policy_always_true`) is **partially addressed** by migration `20260515120600_lock_down_score_and_session_writes.sql`.

| Table | Operation | Status |
|-------|-----------|--------|
| `game_sessions` | INSERT / UPDATE | ✅ Revoked for anon — booth uses `startGameSession` / `submitGameScore` / `abortGameSession` server functions |
| `game_scores` | INSERT | ✅ Revoked for anon — scores via validated `submitGameScore` only |
| `game_sessions` | SELECT | Public — **exposes active session UUIDs** ([§19](#19-booth-persistence-api-hardening--open)); admin also polls via anon client |
| `game_scores` | SELECT | Public — `/scoreboard` (intentional exhibition) |
| `game_config` | SELECT | Public — branding / gameplay JSON (intentional) |
| `player_registrations` | SELECT | Denied — Leads via admin service role only |
| `realtime.messages` | Broadcast | Scoped to `abyssal_session_[A-HJ-NP-Z2-9]{6}` ([`20260515120500`](../supabase/migrations/20260515120500_realtime_session_code_length.sql)) |

**Suggested follow-up:** Rate limits ([§15](#15-rate-limiting-and-abuse--open)); session SELECT policy ([§19](#19-booth-persistence-api-hardening--open)).

---

## Security best practices (operators and developers)

Use this as a minimum bar for production booths. Details in [Deployment.md](./Deployment.md), [Production-Checklist.md](./Production-Checklist.md), [Cloudflare-Deploy.md](./Cloudflare-Deploy.md).

### Secrets and configuration

| Practice | Status in repo |
|----------|----------------|
| `SUPABASE_SERVICE_ROLE_KEY` only on **Worker** / server — never `VITE_*` | ✅ Documented in `.env.example` |
| Anon/publishable key in client only; RLS + server functions enforce boundaries | ✅ |
| `ADMIN_BOOTSTRAP_EMAILS` optional; remove or narrow after operators provisioned | ⚠️ Ops discipline |
| Rotate Supabase keys if `.env` was ever committed | ⚠️ Verify `git log` / `.gitignore` |
| `VITE_APP_ORIGIN` set to production HTTPS URL (QR + OG tags) | ✅ Required for deploy |

### Supabase dashboard

| Practice | Status |
|----------|--------|
| Apply all migrations (`supabase db push` or CI migrate workflow) | Required |
| Realtime: **disable “Allow public access”** when using private Broadcast + RLS | Required ([§5](#5-authorize-or-harden-realtime-broadcast-channels--completed)) |
| Strong passwords for admin Auth users; disable public sign-up if not needed | Recommended |
| Restrict Dashboard access to operators only | Recommended |
| Review **Database → Roles** and **API** logs during events | Recommended |

### Application security

| Practice | Status |
|----------|--------|
| Admin routes gated by Supabase Auth + `admin_users` / `app_metadata.role` | ✅ |
| Admin mutations via service role in [`admin.server.ts`](../src/lib/admin.server.ts) | ✅ |
| Scores/sessions not writable via anon Postgres INSERT | ✅ ([§14](#14-score-cheating--completed)) |
| PII registrations INSERT-only; export via authenticated Leads | ✅ |
| Booth server functions callable without auth | ⬜ See [§19](#19-booth-persistence-api-hardening--open) |
| Rate limiting on registration and server functions | ⬜ See [§15](#15-rate-limiting-and-abuse--open) |
| Production logging: default `VITE_LOG_LEVEL=error` ([`logger.ts`](../src/lib/logger.ts)) | ✅ |

### Hosting (Cloudflare Workers)

| Practice | Status |
|----------|--------|
| HTTPS only; custom domain with TLS | Recommended |
| Workers Builds or GHA deploy with secrets in dashboard — not in repo | ✅ |
| Optional: WAF, bot fight, rate limiting rules | ⬜ Ops |
| `wrangler tail` / Supabase logs during show | Recommended |

### Event-day hygiene

- Run [Production-Checklist.md](./Production-Checklist.md) smoke test (TV, controller, admin, scoreboard).
- Use a clean browser profile on the TV (fewer extensions; avoids console noise — see [Browser-Console.md](./Browser-Console.md)).
- Export Leads after event; plan PII deletion ([§20](#20-gdpr-retention-and-privacy-ops--open)).
- Do not share service role key or admin passwords in chat/email.

---

## Suggested implementation roadmap (updated)

### ~~Sprint 1 — Secure the booth~~ ✅ Done (apply migrations + secrets on host)

1. ✅ Drop public DELETE; drop public `game_config` writes.
2. ✅ Service role only in `admin.server.ts`.
3. ✅ Admin UI error handling.
4. Deploy with `SUPABASE_SERVICE_ROLE_KEY`; provision admin Auth users; `supabase db push`.

### ~~Sprint 2 — Trust the wire~~ ✅ Done

1. ✅ Realtime RLS + private channels + 6-char codes + join tokens.
2. ✅ TV link-lost / idle watchdogs; session break on controller only.
3. ✅ Score/session write error handling + server-validated scores.
4. ✅ Public INSERT/UPDATE on sessions/scores revoked.

### ~~Sprint 3 — Sustainable codebase~~ ✅ Mostly done

1. ✅ Split game engine ([`src/game/`](../src/game/)).
2. ✅ Vitest + critical tests (`npm test`).
3. ✅ Zod config validation; README / docs index.

### Sprint 4 — Hardening and compliance (current)

1. ⬜ [§19](#19-booth-persistence-api-hardening--open) — session SELECT + booth server function auth.
2. ⬜ [§15](#15-rate-limiting-and-abuse--open) — edge rate limits.
3. ⬜ [§20](#20-gdpr-retention-and-privacy-ops--open) — retention + privacy docs.
4. ⬜ Optional Playwright E2E on staging.

---

## Metrics to track after improvements

| Metric | Tool |
|--------|------|
| Realtime connect/disconnect rate | Supabase Realtime dashboard |
| Failed score inserts | Postgres logs / client error counter |
| Avg session duration | `game_sessions.started_at` → `ended_at` |
| Registrations per hour | `player_registrations` count |
| Admin save failures | Server function logs |

---

## Document history

| Date | Author | Notes |
|------|--------|-------|
| 2026-05-15 | Code review | Initial report |
| 2026-05-15 | Re-verification | Status markers; marked P0/security items completed; audit of open issues |
| 2026-05-18 | Security re-review | Leads export done; §19 booth API exposure; §20 GDPR; security checklist; roadmap sprint 4 |

See also: [Solution Design](./solution-design.md), [Security Issues](./issues.md), [Deployment](./Deployment.md), [Production Checklist](./Production-Checklist.md), [Browser Console](./Browser-Console.md), [Eventlead Badge Scanner Analysis](./Eventlead-Badge-Scanner-Analysis.md).
