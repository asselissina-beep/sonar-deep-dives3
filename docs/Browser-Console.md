# Browser console — noise vs app logs 

## What you are seeing

Many messages in DevTools **do not come from ABYSSAL**. Common sources:

| Message | Source |
|---------|--------|
| `Hello content.` / `content.js` | Browser extension content script |
| `Is Medium site: false` | Extension (article/readability helper) |
| `[DEFAULT]: WARN : Using DEFAULT root logger` | **Grammarly** extension |
| `TranslateAgent` / `ExplainerAgent` DEBUG | **Grammarly** extension |
| `A listener indicated an asynchronous response…` | Extension messaging (Chrome) |

To confirm: open the site in **Incognito** with extensions disabled, or another browser profile without extensions. The app bundle should be quiet except real errors.

## App logging (this repo)

Logging is centralized in [`src/lib/logger.ts`](../src/lib/logger.ts).

| Level | When it prints |
|-------|----------------|
| **Default (production)** | `error` only — e.g. failed score/session persist |
| **Default (local dev)** | `warn` and above — e.g. invalid `game_config` row |
| **`VITE_LOG_LEVEL=silent`** | No app logs |
| **`VITE_LOG_LEVEL=debug`** | All app logs |

Set in `.env`:

```env
VITE_LOG_LEVEL=warn
```

Rebuild after changing (`npm run build` or redeploy).

Production builds also strip `console.log` / `console.info` / `console.debug` from bundled dependencies via `vite.config.ts` (esbuild `pure`).

## Tags you might still see from the app

| Prefix | Meaning |
|--------|---------|
| `[game-config]` | Invalid or partial config from Supabase (falls back to defaults) |
| `[game-persistence]` | Session/score write failed after retry |

These respect `VITE_LOG_LEVEL` and default production level `error` (so `[game-config]` warnings do not appear on the live booth unless you raise the level).

## Recommended approach for operators

1. **Ignore extension spam** when debugging the booth — filter the console by your domain or disable extensions on the TV machine.
2. Use **`VITE_LOG_LEVEL=error`** (or omit) in production Cloudflare build variables.
3. Use **`VITE_LOG_LEVEL=warn`** or **`debug`** only when diagnosing config or persistence issues locally.
