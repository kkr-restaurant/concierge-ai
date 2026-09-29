# Deploying ConciergeAI: GitHub → Cloudflare Workers → Supabase

This assumes the full-Cloudflare path: Cloudflare Workers (not Pages) as the
app runtime, via the OpenNext adapter, because your current `next.config.js`
uses `output: "standalone"` (a Node server), which Cloudflare doesn't run
directly. OpenNext rewrites the Next.js build to something Workers can run.

## 1. One-time setup

`wrangler.jsonc`, the `@opennextjs/cloudflare`/`wrangler` devDependencies,
and the `cf:build`/`cf:preview`/`cf:deploy` npm scripts are already in this
repo — just `npm install`.

## 2. Supabase project

1. Create a Supabase project.
2. Run `supabase/schema.sql`, then `supabase/auth-hook.sql`, via the SQL
   editor or `supabase db push`. `schema.sql` creates: `platform_users`,
   `tenants`, `impersonation_sessions`, `incidents` (+ `incident_tenants`
   join table), and a shared `audit_log` table, with RLS scoped to platform
   users only. `auth-hook.sql` adds the custom-claim function and the
   `pg_cron` job that force-ends expired impersonation sessions.
3. In the Supabase dashboard: Authentication → Hooks → enable the
   "Customize Access Token (JWT) Claims" hook, pointing at
   `public.custom_access_token_hook`. This step can't be scripted via SQL.
4. Note your Project URL, `anon` key, and `service_role` key → put them in
   `.env.local` (see `.env.example`) for local dev, and as Wrangler secrets
   for production (`wrangler secret put SUPABASE_SERVICE_ROLE_KEY`, etc).
5. Create your first platform user: sign someone up via Supabase Auth
   (dashboard → Authentication → Users → Add user, or your own sign-up
   flow), enroll a TOTP factor for them, then insert a matching row into
   `platform_users` with that user's `auth.users.id` as `auth_user_id`.

## 3. The population-separation decision (already made — know the trade-off)

The spec (§13, §16) is explicit that platform staff and hotel staff must be
**structurally** separate populations — different signing keys/issuer, not
just a role check — so a hotel-side token can never accidentally pass as a
platform token.

Supabase Auth issues one JWT format per project, so there were two honest
ways to get that separation:

- **Two Supabase projects** (or two Auth instances via separate JWT
  secrets) — the closer match to "different signing keys," at the cost of
  doubling your Supabase setup.
- **One project, one Auth population, a custom claim** — what this repo
  actually does. A [Supabase Auth Hook](https://supabase.com/docs/guides/auth/auth-hooks)
  (`custom_access_token_hook` in `supabase/auth-hook.sql`) stamps
  `population: "platform"` only onto tokens for users with a row in
  `platform_users`. `lib/auth/require-platform.ts` checks that claim (plus
  a live table lookup, in case a platform user was just revoked) before any
  `/api/v1/platform/*` logic runs, and rejects outright — 401/403, never an
  empty 200 — if it's missing.

This is cheaper to run and was the right call for a first build, but it is
genuinely weaker than separate signing keys: a bug in the hook function, or
in `require-platform.ts`, is a single point of failure for the whole
separation guarantee, whereas two projects fail closed by construction. If
this system handles real hotels' guest data, revisit this before GA — the
two-projects approach is a schema/auth migration, not a rewrite, so it's not
wasted effort to start here.

## 4. Talking to Supabase from a Cloudflare Worker

Workers can't hold long-lived TCP connections, so:
- Use the `@supabase/supabase-js` client over HTTPS (works fine in Workers —
  it's REST/PostgREST under the hood, not a raw Postgres connection).
- Avoid `pg`/raw Postgres drivers unless you go through Supabase's
  connection pooler in transaction mode, and even then prefer the JS client
  for anything Worker-side.
- Use the `service_role` key only inside server-side API routes (Next.js
  Route Handlers), never shipped to the client — store it as a Wrangler
  secret (`wrangler secret put SUPABASE_SERVICE_ROLE_KEY`), not in
  `wrangler.jsonc`.

## 5. GitHub Actions

`.github/workflows/deploy.yml` (in this folder): builds on every PR (type
check + build, no deploy), and deploys to Cloudflare on push to `main`.

Add these repo secrets (Settings → Secrets and variables → Actions):
- `CLOUDFLARE_API_TOKEN` — a Workers-scoped token (Cloudflare dashboard →
  My Profile → API Tokens → "Edit Cloudflare Workers" template).
- `CLOUDFLARE_ACCOUNT_ID` — found on any Cloudflare dashboard page's sidebar.

Supabase keys are Worker secrets (`wrangler secret put ...`), not GitHub
secrets — they're needed at runtime, not at build time.

## 6. One more thing I changed while wiring this up

The current `@opennextjs/cloudflare` adapter requires Next.js 15.5.24+ (or
16) — it won't install against the Next 14.2.5 this project started on. I
bumped `next` to `15.5.24` (still on React 18, no React 19 migration
needed) rather than pin to an ancient, likely-unmaintained adapter version.

That upgrade has one real consequence: Next 15 made `cookies()` (in
`next/headers`) and a route handler's `params` **async** — both now return
Promises instead of plain objects. Every file in this repo already accounts
for that (`lib/supabase/server.ts` awaits `cookies()`; every dynamic route
under `app/api/v1/platform/*` awaits `params`). If you add new dynamic
routes later, remember the signature is
`{ params }: { params: Promise<{ id: string }> }`, not the Next 14 shape.

Verified: `npm install`, `npx tsc --noEmit`, and `npx next build` all pass
clean in this repo (the build does need real or placeholder Supabase env
vars in `.env.local` to get through prerendering `/login` and
`/platform/login` — see `.env.example`).

## 7. What's built vs. still open

Built in this pass:
- All §8 endpoints (`app/api/v1/platform/*`) — overview, tenants list/detail/
  create, suspend, reactivate, impersonate start/end, incidents list/
  acknowledge, cross-tenant search, plus a `/session` endpoint the login
  page uses to confirm population right after MFA.
- `lib/auth/require-platform.ts` — the population + role guard every route
  above calls first.
- Real Supabase Auth wiring for both `/login` (optional MFA, per hotel
  settings) and `/platform/login` (mandatory TOTP MFA), replacing the
  hardcoded credential checks.
- `app/platform/page.tsx` now fetches from the real endpoints instead of a
  hardcoded array, and its suspend/impersonate/acknowledge actions call the
  real mutations.
- `audit_log` writes on suspend, reactivate, impersonate start, and
  impersonate end — all marked `visible_to_tenant: true` per §13.
- Server-side TTL enforcement via `supabase/auth-hook.sql`'s `pg_cron` job
  (runs every minute, force-ends any session past `expires_at`), rather
  than relying on the client's countdown or the JWT's own `exp`.

Still open, deliberately out of scope for this pass:
- The Hotel Admin Dashboard side that an impersonation token actually opens
  — that's a different module (spec's "next module recommended"), not
  covered by `02-platform-admin-portal.md`.
- `app/settings/authentication/page.tsx` (sessions, login activity) is
  still mock data — no spec doc was provided for that screen's backend.
- Tenant creation UI (`POST /tenants` exists as an endpoint; the "Create
  tenant" button in the portal header isn't wired to a form yet).
- Rate limiting on search/list endpoints (spec §13) — add at the Cloudflare
  layer (a Worker-level rate limiter or Cloudflare's built-in rate limiting
  rules) rather than in application code.
- Incident *creation* (anomaly detection, §15) — incidents are currently
  only read/acknowledged; nothing in this repo generates them yet, since
  that depends on the AI Orchestrator/monitoring pipeline this repo doesn't
  contain.

## 8. Variables vs. secrets on Cloudflare — read this before touching settings

**What went wrong the first time we deployed:** the Supabase URL, anon key and
service key were added in the Cloudflare dashboard as plain *Variables*. The
build then succeeded — and the site returned HTTP 500 on every login page.
Cause: `wrangler deploy` treats `wrangler.jsonc` as the source of truth and
**deletes any dashboard-defined plain Variable that isn't listed in it**.
Only *Secrets* survive a deploy. The app woke up with no Supabase URL.

The rule now:

| Value | Where it lives | Why |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `wrangler.jsonc` → `vars` | Public by design; versioned so a deploy can't wipe it |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `wrangler.jsonc` → `vars` | Public by design (ships to browsers; protected by RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard → Settings → Variables and secrets, type **Secret** | Bypasses all row-level security — never in git, never a plain Variable |
| `IMPERSONATION_JWT_SECRET` | Dashboard, type **Secret** | Signs impersonation tokens |

Two more things that follow from this:

- **Browser code can't rely on `process.env.NEXT_PUBLIC_*`.** Those get baked
  into the JS at *build* time, and Cloudflare's build doesn't have them. So the
  login pages are server components that read the values at *request* time and
  pass them to the client component as props.
- **If a value is ever missing**, the login pages now show "Sign-in is
  temporarily unavailable" instead of a blank 500, and the middleware logs and
  carries on. Visit `/api/health` to see exactly what's missing (it reports
  presence only, never values, and also flags a wrongly-typed Supabase URL such
  as `.com` instead of `.co`). Delete that endpoint once you have real monitoring.

If the service key ever appears in a screenshot, chat, or commit: treat it as
compromised. Supabase dashboard → Project Settings → API Keys → create a new
secret key, delete the old one, then update the Cloudflare **Secret**.

## Alternative: if you'd rather not use the OpenNext adapter

Keep the existing `Dockerfile`/`output: "standalone"` as-is and deploy the
Node server to a Node-native host (Fly.io, Railway) instead of Cloudflare
Workers, using Cloudflare only for DNS/CDN/WAF in front of it. This avoids
the Workers runtime constraints (edge-only APIs, no long-lived connections)
entirely. Say the word if you'd rather see that setup instead.
