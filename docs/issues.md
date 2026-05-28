# Detected Security Issues

_Snapshot from the security scan view._

## Errors

### 1. ~~Anyone can delete all game sessions~~ (fixed)
- **Scanner:** supabase_lov
- **ID:** `game_sessions_public_delete` (MISSING_RLS_PROTECTION)
- **Level:** error
- **Status:** Fixed in migration `20260515120000_revoke_public_delete_sessions_scores.sql`. Deletes are service-role only via admin server functions.
- **Reference:** https://docs.lovable.dev/features/security

### 2. ~~Anyone can delete all game scores~~ (fixed)
- **Scanner:** supabase_lov
- **ID:** `game_scores_public_delete` (MISSING_RLS_PROTECTION)
- **Level:** error
- **Status:** Fixed in migration `20260515120000_revoke_public_delete_sessions_scores.sql`. Deletes are service-role only via admin server functions.
- **Reference:** https://docs.lovable.dev/features/security

### 3. ~~Anyone on the internet can modify game configuration~~ (fixed)
- **Scanner:** supabase_lov
- **ID:** `game_config_public_update` (UNAUTHORIZED_CONFIG_MODIFICATION)
- **Level:** error
- **Status:** Fixed in migration `20260515120100_revoke_public_write_game_config.sql`. Public INSERT/UPDATE removed; admin updates use service role only (`updateConfigInDb`).
- **Reference:** https://docs.lovable.dev/features/security

## Warnings

### 4. ~~Player email addresses and personal data are publicly readable~~ (fixed)
- **Scanner:** supabase_lov
- **ID:** `player_registrations_public_read` (EXPOSED_SENSITIVE_DATA)
- **Level:** warn
- **Status:** Fixed in migration `20260515120200_lock_down_player_registrations.sql` — `REVOKE ALL` + `GRANT INSERT` only for anon/authenticated; no SELECT/UPDATE/DELETE policies. Admin reads via auth-gated `fetchPlayerRegistrations` server function (service role). Client controller only INSERTs, no `.select()`. `company` column added in `20260517120000_player_registrations_company.sql`.
- **Reference:** https://docs.lovable.dev/features/security

### 5. ~~Any authenticated user can subscribe to any Realtime channel~~ (fixed)
- **Scanner:** supabase_lov
- **ID:** `realtime_no_channel_policies` (REALTIME_UNAUTHORIZED_SUBSCRIPTION)
- **Level:** warn
- **Status:** Fixed in migrations `20260515120300`, `20260515120500` — RLS for 6-char `abyssal_session_*` topics, `private: true` channels, join token in QR, TV token validation + 30s inactivity lobby reset. `game_sessions` removed from realtime publication.
- **Reference:** https://docs.lovable.dev/features/security

### 6. RLS Policy Always True — partially fixed
- **Scanner:** supabase
- **ID:** `SUPA_rls_policy_always_true`
- **Level:** warn
- **Status:** **Partially fixed.** Public `INSERT`/`UPDATE` on `game_sessions` and `INSERT` on `game_scores` removed in migration `20260515120600_lock_down_score_and_session_writes.sql`; booth writes use service-role server functions ([`gamePersistence.functions.ts`](../src/lib/gamePersistence.functions.ts)).
- **Remaining:** Public `SELECT` on sessions/scores/config is intentional for leaderboard and branding; **active `game_sessions` rows are readable by anon** — combined with unauthenticated booth server functions this allows forged score submission if `sessionId` is copied ([improvement-report.md](./improvement-report.md) §19).
- **Reference:** https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy
