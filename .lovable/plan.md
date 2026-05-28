
Goal: make branding saves from `/admin` work again without weakening backend security.

What I found
- The save flow is: `AdminPanel` → `updateGameConfig` in `src/lib/adminServer.ts` → `updateConfigInDb` in `src/lib/admin.server.ts`.
- `game_config` currently allows public `SELECT` only. Public `UPDATE` was intentionally removed in the latest migration.
- The server-side helper currently does this:
  - tries `SUPABASE_SERVICE_ROLE_KEY`
  - if missing, silently falls back to the public/publishable key
- In the current preview/runtime, PIN validation succeeds, but the write falls back to the public key, so RLS blocks the update. That matches the exact error: `Update failed — check database permissions`.
- There is also a UX issue: the save handlers don’t catch the server error, so the page throws an unhandled rejection and can blank-screen.

Implementation plan
1. Fix the admin write path to stay server-only
- Update `src/lib/admin.server.ts` so branding writes never fall back to the public key.
- Use the server-only admin client for `game_config` updates, or equivalent runtime-only service-role initialization.
- Fail fast with a clear server error if the admin client cannot be created, instead of pretending the public key is acceptable for writes.
- Keep PIN validation on the server before the mutation.

2. Clean up the server function boundary
- Keep the DB mutation logic in `.server.ts`.
- Keep the callable RPC wrapper in the server-function file.
- If needed, rename the RPC file to follow the project’s safer TanStack pattern (`*.functions.ts`) so future import-protection issues don’t come back.

3. Preserve security on `game_config`
- Do not restore a broad public `UPDATE` policy.
- First try a code-only fix using the existing backend secret path, because the project already has the needed backend secrets configured.
- Only if backend verification proves the admin client still cannot access the service-role secret in preview, add a secure backend-backed fallback via migration/tooling. I will avoid any “allow everyone to update config” shortcut.

4. Fix the admin UI so failures don’t crash the page
- Wrap `handleConfigUpdate` and editor `handleSave` calls in `try/catch`.
- Show inline error feedback when save fails.
- Reset the saving state correctly on both success and error.
- Only show “Saved” after a confirmed successful update.

5. Verify end-to-end
- Reproduce the save from `/admin`.
- Confirm branding updates persist in the backend and reload correctly.
- Confirm Umami config saves too.
- Confirm no unhandled promise rejection / blank screen remains.

Technical details
- Files likely involved:
  - `src/lib/admin.server.ts`
  - `src/lib/adminServer.ts` (or renamed server-function wrapper)
  - `src/components/AdminPanel.tsx`
- Backend rule to preserve:
  - `game_config` should remain publicly readable but not publicly writable.
- Likely root cause:
  - secure write path was locked down in DB, but app code still contains a public-key fallback for writes.

Expected outcome
- Admin PIN still gates the UI flow.
- Branding and Umami config save successfully.
- No public database write policy is re-opened.
- The admin page shows a friendly error instead of crashing if anything fails again.
