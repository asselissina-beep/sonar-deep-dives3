# Replacing GitHub Actions deploy with Cloudflare Workers Builds

Manual for moving **Worker deployment** from [`.github/workflows/deploy-cloudflare.yml`](../.github/workflows/deploy-cloudflare.yml) to **Cloudflare Workers Builds** (dashboard Git integration). Includes a comparison and a recommendation for ABYSSAL.

**Related:**

- [Cloudflare-Deploy.md](./Cloudflare-Deploy.md) — full first-time deploy (Supabase + Wrangler)
- [Deployment.md](./Deployment.md) — hosting overview
- [Cloudflare Workers Builds docs](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)

---

## What you have today (GitHub Actions)

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| [`ci.yml`](../.github/workflows/ci.yml) | PR + push to `main` | Lint, unit tests, production build (no deploy) |
| [`deploy-cloudflare.yml`](../.github/workflows/deploy-cloudflare.yml) | Push to `main` / manual | Lint, test, build, **`wrangler deploy`** |
| [`supabase-migrate.yml`](../.github/workflows/supabase-migrate.yml) | SQL on `main` / manual | `supabase db push` |

Deploy workflow today:

1. `actions/checkout` + Node 24 + `npm ci`
2. `npm run lint` · `npm test` · `npm run build` (with `VITE_*` from GitHub secrets)
3. `cloudflare/wrangler-action@v3` → `wrangler deploy` + Worker runtime secrets

**Important:** Realtime and Postgres stay on **Supabase**. Only the **TanStack Start Worker** is deployed to Cloudflare. Workers Builds replaces the **deploy workflow only**, not Supabase automation.

---

## What Cloudflare Workers Builds is (OOTB)

**Workers Builds** is Cloudflare’s integrated CI/CD:

- Connects **GitHub** (or GitLab) to a Worker in the dashboard
- On each push: runs a **build command**, then **deploy command** (default `npx wrangler deploy`)
- Non-production branches can run **`npx wrangler versions upload`** for [preview URLs](https://developers.cloudflare.com/workers/configuration/previews/)
- PR comments and check runs on GitHub (build status, preview links)
- Build-time env vars and Worker **runtime** secrets are configured in the dashboard

Official flow: [How Workers Builds works](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#how-workers-builds-works)

TanStack Start on Workers is a [supported framework guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/).

---

## GitHub Actions vs Workers Builds — comparison

| Topic | GitHub Actions | Cloudflare Workers Builds |
|-------|----------------|---------------------------|
| **Runs on** | GitHub-hosted runners (`ubuntu-latest`) | Cloudflare build infrastructure |
| **Deploy to Workers** | `wrangler-action` + API token secrets | Native `wrangler deploy` after build |
| **Config location** | YAML in `.github/workflows/` | Dashboard → Worker → **Settings → Builds** |
| **Trigger** | `on: push`, `workflow_dispatch`, path filters | Branch connected in dashboard |
| **PR checks** | `ci.yml` on pull requests | Optional preview deploy + GitHub check run |
| **Preview deploys** | Custom workflow required | Built-in (`wrangler versions upload` on non-prod branches) |
| **Secrets** | GitHub Actions secrets | Build variables + Worker **Variables & Secrets** |
| **`VITE_*` at build** | GitHub secrets in workflow `env` | **Build** environment variables (not runtime) |
| **Worker runtime secrets** | `wrangler-action` `secrets:` block | Dashboard **Settings → Variables & Secrets** (encrypted) |
| **Lint / test** | Explicit steps (full control) | Only if you add them to **build command** |
| **Supabase migrations** | `supabase-migrate.yml` | **Not supported** — keep GHA or run manually |
| **Path filters** | `paths` / `paths-ignore` in YAML | All pushes to connected branch (no YAML paths-ignore) |
| **Concurrency / cancel** | `concurrency:` in YAML | [Build limits](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/) (1 concurrent on Free) |
| **Logs** | GitHub Actions tab | Cloudflare dashboard → Worker → **Deployments** |
| **Fork PRs** | `ci.yml` uses placeholder secrets | Typically no production secrets on untrusted forks |
| **Vendor lock-in** | GitHub | Cloudflare (deploy path) |

### Pricing (planning)

| | GitHub Actions | Workers Builds |
|--|----------------|----------------|
| **Typical cost for this repo** | Within free tier for small teams | **3,000 build min/mo** (Free) · **6,000 included** on Workers Paid ($5/mo min), then **$0.005/min** |
| **This project per deploy** | ~3–6 min (install + lint + test + build + deploy) | Similar if build command includes lint/test |
| **Reference** | [GitHub Actions billing](https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions) | [Builds limits & pricing](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/) |

At booth-project cadence (tens of deploys/month), **both are effectively $0** on paid/free tiers.

### Limitations

| Limitation | GitHub Actions | Workers Builds |
|------------|----------------|----------------|
| **Supabase `db push`** | Yes (CLI in workflow) | No — must keep separate pipeline |
| **Complex matrices / jobs** | Yes | Single build + deploy pipeline per Worker |
| **Reusable org workflows** | Yes | No |
| **Exact Node version pin** | `setup-node@v5` → `24` | Use build command / `engines` in `package.json` (verify image Node version in build logs) |
| **Disable deploy on docs-only push** | `paths-ignore` in YAML | No — every push to production branch builds (unless you use a monorepo root dir only) |
| **Required reviewers before deploy** | GitHub Environments | Use branch protection + required **Workers Builds** check, not full environment gates |

---

## Recommendation for ABYSSAL

| Approach | Verdict |
|----------|---------|
| **Replace everything with Workers Builds only** | **Not recommended** — you lose easy Supabase migrations CI and split quality gates unless the build command runs lint+test on every deploy. |
| **Hybrid (recommended)** | **Workers Builds** for **production deploy** + keep **`ci.yml`** on PRs + keep **`supabase-migrate.yml`** on `main`. |
| **Keep GitHub Actions only** | **Fine** if you already manage `CLOUDFLARE_*` secrets and want path filters + one place for all CI logs. |

### Why hybrid fits this project

1. **Supabase** — migrations and `SUPABASE_PROJECT_REF` stay in GitHub Actions (or manual CLI); Cloudflare has no equivalent.
2. **PR quality** — `ci.yml` runs lint/test/build on every PR without deploying; fork PRs can use placeholder `VITE_*` values.
3. **Production deploy** — Workers Builds gives native deploy, preview URLs on branches, and fewer Cloudflare tokens in GitHub.
4. **Avoid double deploy** — after enabling Workers Builds, **disable or delete** `deploy-cloudflare.yml` (or remove `push` trigger) so one push does not deploy twice.

### Suggested end state

```
PR opened/updated     →  GitHub Actions: ci.yml (lint, test, build)
Push supabase/migrations →  GitHub Actions: supabase-migrate.yml (if secrets set)
Push main (app code)   →  Cloudflare Workers Builds (lint+test+build+deploy)
```

Optional: remove lint/test from Workers Builds build command if `ci.yml` already passed via required check on `main` — faster deploys, slightly less redundancy.

---

## Manual: Enable Workers Builds (replace deploy workflow)

### Prerequisites

- Cloudflare account with Workers Paid or Free
- Worker already exists (from manual `wrangler deploy` or previous GHA deploy)
- GitHub repo admin access
- Supabase and `VITE_*` values documented ([Cloudflare-Deploy.md](./Cloudflare-Deploy.md) Phase 1 & 3)

### Step 1 — Connect GitHub repository

1. Open [Cloudflare dashboard](https://dash.cloudflare.com) → **Workers & Pages**.
2. Select Worker **`sonar-deep-dives`** (name from [`wrangler.jsonc`](../wrangler.jsonc)) — or **Create** → **Import a repository** if new.
3. Go to **Settings** → **Builds** → **Connect to GitHub**.
4. Authorize Cloudflare, select this repository.
5. **Production branch:** `main` (or `master`).

Docs: [GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)

### Step 2 — Configure build settings

**Settings → Builds:**

| Setting | Value for ABYSSAL |
|---------|-------------------|
| **Root directory** | `/` (repo root) |
| **Build command** | `npm ci && npm run lint && npm test && npm run build` |
| **Deploy command** | `bun run deploy` or `npx wrangler deploy` — must **not** run `vite build` again (repo `deploy` script is `wrangler deploy` only) |
| **Non-production branch deploy command** | `npx wrangler versions upload` (default; enables preview URLs) |
| **Enable non-production branch builds** | Optional — useful for QA branches |

**Stronger quality gate (matches current GHA deploy workflow):** use the full build command above.

**Faster deploys (if `ci.yml` is required on `main`):** `npm ci && npm run build` only.

### Step 3 — Build environment variables

**Settings → Builds → Build variables** (available only during build, not at Worker runtime):

| Variable | Required | Example |
|----------|----------|---------|
| `VITE_SUPABASE_URL` | Yes | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase anon / publishable key |
| `VITE_APP_ORIGIN` | Yes | `https://game.yourcompany.com` |
| `VITE_OG_IMAGE_URL` | No | Public OG image URL |
| `BUILD_NUMBER` | No | Use `WORKERS_CI_BUILD_UUID` or set a static label |

Cloudflare injects `CI=true`, `WORKERS_CI=1`, `WORKERS_CI_COMMIT_SHA`, `WORKERS_CI_BRANCH` by default — you can use these in scripts if needed.

Do **not** put `SUPABASE_SERVICE_ROLE_KEY` in build variables if it is only needed at runtime (and never prefix secrets with `VITE_`).

### Step 4 — Worker runtime variables and secrets

**Settings → Variables & Secrets** (Worker runtime — same as `wrangler secret put`):

| Name | Type | Notes |
|------|------|--------|
| `SUPABASE_URL` | Variable or secret | Same as `VITE_SUPABASE_URL` |
| `SUPABASE_PUBLISHABLE_KEY` | Secret | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Server-only |
| `ADMIN_BOOTSTRAP_EMAILS` | Variable | Optional |

These replace the `secrets:` block in `deploy-cloudflare.yml`.

### Step 5 — API token

Workers Builds can **auto-create** a deploy token. Recommended: use the auto token unless you need a custom scoped token ([API token settings](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#api-token)).

You can then **remove** GitHub secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` if nothing else uses them.

### Step 6 — Test a build

1. Push a small commit to `main` (or **Retry build** in the dashboard).
2. Open **Deployments** → confirm build + deploy succeed.
3. Smoke-test: TV `/`, controller QR, `/admin`, `/scoreboard`.

### Step 7 — Disable GitHub Actions deploy (avoid double deploy)

Choose one:

**Option A — Delete workflow file (cleanest)**

```bash
git rm .github/workflows/deploy-cloudflare.yml
git commit -m "ci: deploy via Cloudflare Workers Builds"
```

**Option B — Manual-only GHA deploy**

In `deploy-cloudflare.yml`, change triggers to:

```yaml
on:
  workflow_dispatch:
```

Keep the file as an emergency fallback.

### Step 8 — Branch protection (optional)

On GitHub **Settings → Branches → main**:

- Require status check **Workers Builds** (or the check name shown on PRs) before merge.
- Keep requiring **`CI` / `verify`** from `ci.yml` for lint/test on PRs.

### Step 9 — Keep Supabase migrations on GitHub Actions

Do **not** remove [`supabase-migrate.yml`](../.github/workflows/supabase-migrate.yml).

Ensure secrets exist: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`.

Migrations are unrelated to Cloudflare deploy; run on `supabase/migrations/**` changes only.

---

## Environment variable mapping (GHA → Cloudflare)

| GitHub Actions secret | Workers Builds location |
|----------------------|-------------------------|
| `VITE_SUPABASE_URL` | Build variable |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Build variable |
| `VITE_APP_ORIGIN` | Build variable |
| `VITE_OG_IMAGE_URL` | Build variable |
| `SUPABASE_URL` | Worker secret/variable |
| `SUPABASE_PUBLISHABLE_KEY` | Worker secret |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker secret |
| `ADMIN_BOOTSTRAP_EMAILS` | Worker variable |
| `CLOUDFLARE_API_TOKEN` | Not needed on GitHub (CF manages) |
| `CLOUDFLARE_ACCOUNT_ID` | Not needed on GitHub |
| `SUPABASE_*` (migrate) | Stay in **GitHub Actions** only |

---

## Rollback to GitHub Actions deploy

1. Re-enable [`deploy-cloudflare.yml`](../.github/workflows/deploy-cloudflare.yml) (restore from git history).
2. Re-add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to GitHub secrets.
3. In Cloudflare → Worker → **Settings → Builds** → **Disconnect** repository (or pause builds).
4. Run workflow **Deploy Cloudflare** manually once to confirm.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails: `VITE_*` undefined | Add build variables in **Settings → Builds** |
| App loads but **Missing Supabase URL or anon key**; build vars look correct | Deploy command may have run **`npm run build` again** without build env. Use **Deploy** = `bun run deploy` where `package.json` `"deploy"` is **`wrangler deploy` only** (see repo `package.json`). Retry deployment. |
| Admin save fails after CF-only deploy | Set `SUPABASE_SERVICE_ROLE_KEY` under **Variables & Secrets**, redeploy |
| Two production deploys per push | Disable `deploy-cloudflare.yml` push trigger |
| Preview URL on PR but production unchanged | Expected: non-prod uses `wrangler versions upload` |
| Build minutes exhausted | See [limits](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/); reduce build command or upgrade Workers Paid |
| Node version mismatch | Pin `engines.node` in `package.json`; check build log |

---

## Summary

| Question | Answer |
|----------|--------|
| Can Workers Builds replace **all** GitHub Actions? | **No** — keep Supabase migrate (and ideally PR `ci.yml`). |
| Can it replace **deploy-cloudflare.yml**? | **Yes** — recommended with dashboard config above. |
| What is better for ABYSSAL? | **Hybrid:** Workers Builds for deploy + GHA for PR CI + Supabase migrations. |
| What is cheaper? | Both are ~$0 at your deploy frequency; Workers Builds minutes count toward CF quota, GHA toward GitHub quota. |

---

*Document version: 2026-05-15 — matches `deploy-cloudflare.yml`, `ci.yml`, `supabase-migrate.yml`, and `wrangler.jsonc` (`sonar-deep-dives`).*
