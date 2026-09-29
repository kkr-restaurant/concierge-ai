-- Run this AFTER schema.sql.
-- Two independent pieces: (1) the custom access token hook that makes
-- population separation a JWT-level fact instead of just a table lookup,
-- and (2) a scheduled job that force-ends expired impersonation sessions
-- server-side, so a client that never calls .../end can't keep a session
-- "logically active" past its TTL (spec §20: "time-boxed server-side, not
-- just client-countdown-enforced").

-- ---------------------------------------------------------------------------
-- 1. Custom Access Token Hook
-- ---------------------------------------------------------------------------
-- Stamps `app_metadata.population: "platform"` and
-- `app_metadata.platform_role: <role>` into the JWT for any auth user with
-- a row in platform_users. Every other user (i.e. every hotel-side user)
-- gets a token with no such claim at all — lib/auth/require-platform.ts
-- reads session.user.app_metadata.population and treats its absence as an
-- automatic reject.
--
-- IMPORTANT: these must be nested inside app_metadata, not set as top-level
-- claims. supabase-js's session.user.app_metadata is populated only from
-- the JWT's app_metadata claim — a top-level custom claim (the original,
-- broken version of this function) is invisible to that object, so the
-- population check would silently always fail even for a real platform
-- user. This is also the pattern Supabase's own docs use for this kind of
-- hook (e.g. their RBAC example: '{app_metadata, claims_admin}').
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  claims jsonb;
  platform_role text;
begin
  claims := event->'claims';

  select role::text into platform_role
  from public.platform_users
  where auth_user_id = (event->>'user_id')::uuid;

  if platform_role is not null then
    claims := jsonb_set(claims, '{app_metadata,population}', '"platform"');
    claims := jsonb_set(claims, '{app_metadata,platform_role}', to_jsonb(platform_role));
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- After running this, register the hook in the Supabase dashboard:
-- Authentication → Hooks → Customize Access Token (JWT) Claims hook,
-- pointing at public.custom_access_token_hook. (This registration step
-- can't be done from SQL alone — it's a project-level Auth config change.)
--
-- IMPORTANT: this function must be SECURITY DEFINER (set above). Supabase
-- Auth calls hook functions as the `supabase_auth_admin` role, which has
-- no table grant on platform_users and doesn't satisfy the is_platform_user()
-- RLS policy either. Without SECURITY DEFINER, every login attempt fails
-- with "Error running hook" the moment the function tries to read
-- platform_users. SECURITY DEFINER makes it run as its owner (a superuser)
-- instead, bypassing both the missing grant and RLS for this one query.

-- ---------------------------------------------------------------------------
-- 2. Server-side TTL enforcement for impersonation sessions
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;

create or replace function public.expire_impersonation_sessions()
returns void
language sql
set search_path = public, pg_temp
as $$
  update impersonation_sessions
  set ended_at = now(), ended_reason = 'expired'
  where ended_at is null
    and expires_at <= now();
$$;

select cron.schedule(
  'expire-impersonation-sessions',
  '* * * * *', -- every minute
  $$select public.expire_impersonation_sessions();$$
);

-- Note: this only updates the row. Anything reading impersonation_sessions
-- to decide "is this still live" (e.g. the tenant-side check on an
-- incoming impersonation token) should check `ended_at is null AND
-- expires_at > now()` directly rather than relying solely on this job
-- having already run in the same minute.
