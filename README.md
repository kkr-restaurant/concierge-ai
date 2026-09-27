# Hotel AI Assistant Platform — Authentication module

Next.js 15 (App Router) + TailwindCSS. Now wired to a real backend: Supabase
(Postgres + Auth) for data and authentication, deployed to Cloudflare
Workers via the OpenNext adapter. See `DEPLOYMENT.md` for the full setup.

The `app/settings/authentication/page.tsx` screen (sessions, login activity)
is still mock data — it wasn't part of the §7/§8 spec this backend build
covers. Everything under `app/platform/*` and `app/api/v1/platform/*` is
real: real Supabase Auth, real Postgres tables, real mutations.

## Quick start

```bash
cp .env.example .env.local   # fill in your Supabase project's values
npm install
npm run dev
```

You'll also need to:
1. Run `supabase/schema.sql` then `supabase/auth-hook.sql` against your
   Supabase project (SQL editor or `supabase db push`).
2. Register the custom access token hook in the Supabase dashboard
   (Authentication → Hooks) — see the comment at the bottom of
   `auth-hook.sql`.
3. Create at least one row in `platform_users` (with a matching
   `auth.users` row) to have a platform account to log in with.

Full walkthrough, the population-separation design decision, and the
Cloudflare deploy pipeline: see `DEPLOYMENT.md`.

---

_Original demo description below, kept for context on the UI/UX intent._

A runnable front-end demo of the login flow and the authentication settings
screen described in the design spec. Built with Next.js 14 (App Router) + TailwindCSS.

## Run with Docker (recommended)

```bash
docker compose up --build
```

Then open **http://localhost:3000** — it redirects straight to `/login`.

Or without compose:

```bash
docker build -t hotel-ai-auth .
docker run -p 3000:3000 hotel-ai-auth
```

## Run locally without Docker

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Two separate populations, two separate surfaces

This app models both sides described in the spec docs:

- **Hotel tenant side** (brass/ink theme) — a single hotel's own staff.
- **Platform admin side** (steel-blue/ink theme) — the platform vendor's own
  staff, managing every tenant. Deliberately different branding, domain
  framing, and color language, per the "population separation" design
  decision in `02-platform-admin-portal.md` §16 — the two should never be
  visually confusable.

## Try it — hotel tenant side

**Login** (`/login`)
- Email: `fatima.alzahrani@grandriyadh.com`
- Password: `keycard-9182`
- MFA code: `482913`

Wrong credentials show the invalid-credentials error state. The MFA screen
auto-advances per digit and accepts a pasted 6-digit code.

**Authentication settings** (`/settings/authentication`)
- Toggle "Require for all users" under MFA to see the toast + optimistic
  update pattern.
- Go to the Sessions tab and click "Revoke" on a session to see the
  confirmation dialog, then the toast and row removal.
- Login Activity tab shows the audit-log table styling (monospace ledger).

## Try it — platform admin side

**Login** (`/platform/login`)
- Email: `admin@hotelaiplatform.internal`
- Password: `control-room-77`
- MFA code: `551204` (mandatory here, no opt-out)

**Platform portal** (`/platform`)
- Open the `⋮` menu on any tenant row → **Impersonate** → pick a reason →
  Start session. Watch the red banner appear at the top with a live session
  context, and an "End session" control.
- Open the `⋮` menu → **Suspend** on an active tenant. Notice the Suspend
  button stays disabled until you type the tenant's exact name — that's
  intentional friction given the blast radius of taking a live hotel's AI
  offline.
- Acknowledge an incident in the right-hand panel to see it clear from the
  open-incidents list.

## What's mocked vs. real

Real: the actual React state machine for login → MFA → success, form
validation, the revoke-session confirm/toast flow, tab switching, responsive
layout, dark UI, keyboard-friendly MFA input.

Mocked: all data is hardcoded in the page files (`app/login/page.tsx`,
`app/settings/authentication/page.tsx`) — there's no API, database, or real
session/JWT handling. That's the natural next step if you want to wire this
into the API design from the spec doc.
