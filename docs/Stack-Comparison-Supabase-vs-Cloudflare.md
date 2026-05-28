# Backend stack comparison — Supabase vs full Cloudflare

This document compares **keeping Supabase** (current production pattern: **Cloudflare Workers app + Supabase backend**) with **moving everything to Cloudflare** for ABYSSAL (Sonar Deep Dives). Use it to decide whether a migration is worth the engineering cost.

**Pricing and limits change often.** Verify on official pages before budgeting:

- [Supabase pricing](https://supabase.com/pricing) · [Realtime pricing](https://supabase.com/docs/guides/realtime/pricing)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Cloudflare Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)

**Related:** [Cloudflare-Deploy.md](./Cloudflare-Deploy.md) (hybrid deploy today) · [solution-design.md](./solution-design.md) (architecture)

---

## Executive summary

| Question | Answer |
|----------|--------|
| **Can we replace Supabase with a full Cloudflare stack?** | **Yes, in principle** — but it is a **large rewrite**, not a config swap. |
| **Is it a good idea for this project today?** | **Usually no** unless you have a strong ops reason (single vendor, edge-only, no Postgres ops). The app is already optimized for **Workers + Supabase**. |
| **Recommended default** | **Keep hybrid:** TanStack Start on **Workers**, data + Realtime + admin Auth on **Supabase**. |
| **When full Cloudflare makes sense** | You want one bill/vendor, booth scale is modest, and you accept rebuilding auth, RLS, Realtime, and all SQL migrations. |

---

## What ABYSSAL uses from Supabase today

| Capability | How the app uses it |
|------------|---------------------|
| **PostgreSQL** | `game_config`, `game_sessions`, `game_scores`, `player_registrations`, `admin_users` |
| **Row Level Security (RLS)** | INSERT-only registrations; no public read of PII; broadcast channel policies; score/session rules |
| **Realtime Broadcast** | TV ↔ phone game input on `abyssal_session_{code}` (~20 Hz throttled) |
| **Realtime `postgres_changes`** | Live scoreboard; `game_config` sync in admin |
| **Supabase Auth** | Email/password for `/admin` operators |
| **Service role** | Server functions bypass RLS for admin writes, lead export, validated scores |
| **SQL migrations** | `supabase/migrations/*.sql` + CI `supabase db push` |
| **Client SDK** | Browser inserts registrations; Realtime channels; admin reads via server functions |

**Not used:** Storage buckets, Edge Functions (Supabase), visitor OAuth, database webhooks.

**Already on Cloudflare:** TanStack Start SSR, server functions (`adminServer`, game persistence), static assets, optional CI deploy to Workers.

---

## Full Cloudflare mapping (if you migrate)

| Supabase piece | Cloudflare replacement | Notes for ABYSSAL |
|----------------|------------------------|-------------------|
| PostgreSQL + RLS | **D1** (SQLite) + **Workers** enforcement | Re-implement all policies in TypeScript; no RLS in D1. Complex `broadcast` RLS → custom channel auth in code. |
| Realtime Broadcast | **Durable Objects** + WebSockets (or **PartyKit** on CF) | One DO (or room) per session code; fan-out controller → TV messages. |
| `postgres_changes` | DO broadcast, **SSE**, or **polling** | Scoreboard already could poll; config sync today uses postgres_changes — needs a new push path. |
| Supabase Auth | **Cloudflare Access**, **Auth.js / Better Auth** on Workers, or third-party (Clerk) | No drop-in email admin login; migrate `admin_users` + sessions. |
| Service role | Worker secrets + **no direct client DB** | Aligns with current direction; keep all writes on server. |
| Migrations | **D1 migrations** (`wrangler d1 migrations`) | Rewrite ~20 SQL files (Postgres → SQLite dialect differences). |
| Types / ORM | Drizzle + `wrangler types` | Replace `src/integrations/supabase/types.ts`. |
| Local dev | `wrangler dev` + Miniflare D1/DO | Replace `supabase start` (see [Docker.md](./Docker.md)). |

**Optional hybrid on Cloudflare:** **Hyperdrive** + external Postgres (keep SQL/RLS semantics, still drop Supabase Realtime/Auth).

---

## Feature comparison

| Feature | Supabase (current) | Full Cloudflare | Winner for this app |
|---------|-------------------|-----------------|---------------------|
| **Relational DB** | Managed Postgres | D1 (SQLite) or Hyperdrive→Postgres | **Supabase** — Postgres + existing migrations |
| **Declarative RLS** | SQL policies, tested in migrations | App-layer only (Workers) | **Supabase** — less custom security code |
| **Low-latency game sync** | Realtime Broadcast, mature JS SDK | Durable Objects WebSockets | **Tie** — both work; DO = more code |
| **Live DB change feed** | `postgres_changes` built-in | Custom (DO / poll / Queue) | **Supabase** |
| **Admin email/password** | Auth product + dashboard | Roll your own or Access | **Supabase** — already integrated |
| **PII / GDPR table** | RLS + INSERT-only grants | Worker-only writes to D1 | **Tie** if client never touches DB |
| **Dashboard / SQL editor** | Supabase Studio | D1 dashboard (basic) | **Supabase** |
| **Edge SSR** | External (Workers) | Native Workers | **Cloudflare** (already used) |
| **Single vendor** | Two (CF + Supabase) | One | **Cloudflare** |
| **Vendor WebSocket to client** | `*.supabase.co` | Same origin or `*.workers.dev` | **Cloudflare** — one less domain at venues |
| **Migration effort** | Done | **High** (weeks) | **Supabase** |
| **Team familiarity** | Postgres + Supabase docs | Workers + DO + D1 | Depends on team |

---

## Pricing comparison (booth-oriented)

Estimates are **order-of-magnitude** for planning (USD). ABYSSAL Realtime traffic does **not** bill as Worker HTTP requests.

### Traffic model (same as [Cloudflare-Deploy.md](./Cloudflare-Deploy.md))

| Input | Example (3-day show) |
|-------|----------------------|
| Players/day | 400 |
| Play time | ~4 min |
| TVs | 1 |
| Peak concurrent phones + TV | ~5–15 Realtime connections |
| Worker HTTP requests | ~14k/month (very low) |

### Option A — Hybrid (recommended today)

| Service | Typical plan | Estimated monthly (event month) |
|---------|--------------|----------------------------------|
| Cloudflare Workers | Paid ($5 min) | **~$5** |
| Supabase | Pro ($25 base) | **~$25** |
| Overages (Realtime messages/connections) | Within Pro quotas at single-booth scale | **~$0** |
| **Total** | | **~$30–35** |

**Free-tier pilot:** $0 possible on Workers Free + Supabase Free if peak connections and message quotas stay low (risky for busy shows).

### Option B — Full Cloudflare (single booth, production)

| Service | Typical plan | Estimated monthly |
|---------|--------------|-------------------|
| Workers Paid | $5 min + included requests/CPU | **~$5** |
| D1 | Included in Workers Paid (25B rows read, 50M writes/mo) | **~$0** at booth scale |
| Durable Objects | Paid: 1M requests + 400k GB-s included | **~$5–15** (depends on WebSocket churn & message volume) |
| Auth | Access (per-seat) or $0 if custom JWT on Workers | **$0–$7+/user/mo** (Access) or dev time |
| **Total** | | **~$10–25+** (excluding Access seats) |

At booth scale, **full Cloudflare is not dramatically cheaper** than hybrid; savings are mostly **operational** (one console), not automatic.

### Option C — High traffic / multi-TV

| | Hybrid (Supabase) | Full Cloudflare |
|--|-------------------|-----------------|
| Realtime | Pro includes 500 peak connections, 5M messages; overages per [Realtime pricing](https://supabase.com/docs/guides/realtime/pricing) | DO requests + GB-seconds scale with connections × duration |
| Database | Postgres Pro 8 GB; read replicas on higher tiers | D1 size limits; SQLite write concurrency per database |
| Risk | Message/connection overages | Hot session DO + D1 write contention |

---

## Limitations

### Supabase (hybrid) limitations

| Limitation | Impact on ABYSSAL |
|------------|-------------------|
| **Two vendors** | CF secrets + Supabase keys; venue firewall must allow `*.supabase.co` WebSockets |
| **Realtime quotas** | Free/Pro caps on peak connections and messages; busy multi-TV shows need monitoring |
| **Region** | DB + Realtime region fixed at project create; pick near event |
| **Auth on Supabase** | Admin users live in Supabase Auth; separate from Cloudflare account |
| **RLS complexity** | Migrations must stay correct; linter warnings on permissive policies |
| **No edge Postgres** | DB round-trip from Workers to Supabase region (acceptable for admin/score APIs) |

### Full Cloudflare limitations

| Limitation | Impact on ABYSSAL |
|------------|-------------------|
| **D1 is SQLite, not Postgres** | Migration rewrite; no `uuid`/`timestamptz` parity; different indexing and constraints |
| **No built-in RLS** | Every rule in Workers; higher risk of regression vs SQL policies |
| **No Supabase-style Auth** | Rebuild admin login, password reset, session refresh |
| **Durable Objects learning curve** | Session rooms, hibernation, routing, testing locally harder than Broadcast SDK |
| **DO/D1 limits** | Per-object storage, SQLite write serialization; many concurrent booths on one DB need design |
| **Realtime rewrite** | Replace `gameChannel.ts`, TV + controller subscriptions, join-token auth model |
| **CI/CD** | Replace `supabase-migrate.yml` with `wrangler d1 migrations apply` |
| **Hyperdrive alternative** | Keeps Postgres but adds cost + still need DO for game sync + separate auth |

---

## Migration effort (rough)

| Workstream | Effort | Risk |
|------------|--------|------|
| Schema: Postgres → D1 + data migration | Medium | Medium — dialect + types |
| Replace Realtime Broadcast with DO WebSockets | **High** | **High** — core gameplay path |
| Replace `postgres_changes` (config, scoreboard) | Low–medium | Low |
| Replace Supabase Auth for admin | Medium | Medium |
| Port RLS to server-only APIs | Medium | **High** — security |
| Remove `@supabase/*` client; Drizzle/D1 | Medium | Medium |
| Docs, CI, Docker local stack | Low | Low |
| Regression / load test at venue | Medium | **High** |

**Ballpark:** **2–4+ weeks** for one experienced developer, assuming no scope creep.

---

## Decision matrix

| Goal | Recommendation |
|------|----------------|
| Ship next event with lowest risk | **Keep Supabase** |
| Minimize monthly cost at single-booth scale | **Hybrid** (similar cost to full CF) |
| Single vendor / one support channel | **Consider full Cloudflare** (after budget for rewrite) |
| Keep Postgres + RLS, drop only Realtime | **Hyperdrive + Durable Objects** (still hybrid) |
| Maximum edge locality for game messages | **Durable Objects** (with or without Supabase DB) |

---

## Sync status — can we “just switch”?

| Component | Sync possible without rewrite? |
|-----------|-------------------------------|
| Workers deploy | ✅ Already synced |
| Database | ❌ Different engine/API |
| Realtime game channel | ❌ Different protocol/SDK |
| Admin auth | ❌ Different identity provider |
| RLS / security model | ❌ Must re-express in code |
| CI migrations | ❌ Different toolchain |

**Conclusion:** There is **no automatic sync** or re-export from Supabase to Cloudflare. A full move is a **deliberate migration project**, not a configuration change.

---

## Suggested next steps

1. **Short term:** Stay on **Workers + Supabase**; fix CI secrets (`SUPABASE_PROJECT_REF`, etc.) per [supabase-migrate.yml](../.github/workflows/supabase-migrate.yml).
2. **If exploring Cloudflare-only:** Spike a **single-session Durable Object** proof-of-concept (TV + one phone) before committing to D1 schema migration.
3. **If cost is the driver:** Model Realtime usage for your largest expected show; compare to [Supabase Realtime pricing](https://supabase.com/docs/guides/realtime/pricing) vs projected DO GB-seconds.
4. **If vendor count is the driver:** Evaluate **Hyperdrive + Postgres** (keep SQL) + **DO for game sync** as a middle path.

---

*Document version: 2026-05-15 — aligned with ABYSSAL codebase (Leads admin, server-validated scores, private Realtime broadcast).*
