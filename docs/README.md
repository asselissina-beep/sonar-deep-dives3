# ABYSSAL (Sonar Deep Dives) — Documentation

Conference engagement game: visitors use a **phone as a wireless controller** to pilot a submarine on a **TV/display**. This folder contains technical documentation for operators, developers, and architects.

## Documents

| Document | Audience | Contents |
|----------|----------|----------|
| [Setup](./Setup.md) | Developers | **Prerequisites**, dependencies, `.env`, Supabase CLI, local dev, verification |
| [Deployment](./Deployment.md) | DevOps, operators | Hosting providers, production env, admin operators |
| [Production Checklist](./Production-Checklist.md) | DevOps, operators | **Go-live validation**, smoke tests, gaps & booth-day checklist |
| [Cloudflare Deploy](./Cloudflare-Deploy.md) | DevOps | Workers + Wrangler, secrets, custom domain, CI/CD |
| [Solution Design](./solution-design.md) | Developers, architects | System context, components, data model, realtime protocol, operational runbook |
| [Improvement Report](./improvement-report.md) | Tech leads, security, product | Prioritized recommendations with ✅/🔶/⬜ status |
| [Security Issues](./issues.md) | Security review | Scanner findings snapshot (RLS, Realtime) |

## Quick links

- **Product README:** [../README.md](../README.md) — overview, prerequisites, getting started
- **Environment template:** [../.env.example](../.env.example)
- **Supabase migrations:** [../supabase/migrations/](../supabase/migrations/)
- **Source entry points:** `src/routes/`, `src/components/SubmarineGame.tsx`, `src/game/`, `src/lib/gameChannel.ts`, `src/lib/gameConfig.ts`
- **Gameplay defaults:** documented in [../README.md#gameplay-defaults-admin--gameplay-tuning](../README.md#gameplay-defaults-admin--gameplay-tuning) (mirrors `DEFAULT_GAMEPLAY_SETTINGS`)

## Product name vs. repo

The shipped experience is branded **ABYSSAL** (Sonar Field Test). The repository name is `sonar-deep-dives`. Configuration in `game_config` can override display names for white-label events.
