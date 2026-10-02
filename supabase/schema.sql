-- Hotel AI Assistant Platform — Platform Admin Portal schema
-- Based on 02-platform-admin-portal.md §7 (Data Model) and §13 (Security)
-- Run this in the Supabase SQL editor, or via `supabase db push`.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type tenant_plan as enum ('starter', 'pro', 'enterprise');
create type tenant_status as enum ('trial', 'active', 'at_risk', 'suspended', 'churned');
create type platform_role as enum ('platform_admin', 'support_engineer', 'platform_ops', 'billing_ops', 'auditor');
create type impersonation_reason as enum ('bug_reproduction', 'support_ticket', 'onboarding', 'other');
create type impersonation_end_reason as enum ('manual', 'expired');
create type incident_severity as enum ('critical', 'warning', 'info');
create type incident_status as enum ('open', 'acknowledged', 'resolved');

-- ---------------------------------------------------------------------------
-- Platform users (vendor staff — a SEPARATE population from tenant/hotel users)
-- ---------------------------------------------------------------------------
-- IMPORTANT: this table is deliberately not the same table (or auth population)
-- as hotel-side users. See "population separation" note in SETUP.md — a
-- tenant-scoped Supabase Auth user must never be able to acquire a row here.
create table platform_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  role platform_role not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tenants (hotels)
-- ---------------------------------------------------------------------------
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan tenant_plan not null default 'starter',
  status tenant_status not null default 'trial',
  ai_health_score integer not null default 100 check (ai_health_score between 0 and 100),
  created_at timestamptz not null default now(),
  suspended_at timestamptz,
  suspended_reason text,
  suspended_by uuid references platform_users (id)
);

create index tenants_status_idx on tenants (status);
create index tenants_plan_idx on tenants (plan);

-- ---------------------------------------------------------------------------
-- Impersonation sessions
-- ---------------------------------------------------------------------------
create table impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  platform_user_id uuid not null references platform_users (id),
  tenant_id uuid not null references tenants (id),
  reason_code impersonation_reason not null,
  reason_note text,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  ended_reason impersonation_end_reason,
  -- §13: content is masked even during impersonation until explicitly revealed
  content_revealed_at timestamptz,
  content_reveal_reason text
);

create index impersonation_sessions_tenant_idx on impersonation_sessions (tenant_id);
create index impersonation_sessions_active_idx on impersonation_sessions (platform_user_id) where ended_at is null;

-- ---------------------------------------------------------------------------
-- Incidents (+ join table instead of an array column, for real FK integrity)
-- ---------------------------------------------------------------------------
create table incidents (
  id uuid primary key default gen_random_uuid(),
  severity incident_severity not null,
  title text not null,
  description text,
  status incident_status not null default 'open',
  first_seen timestamptz not null default now(),
  acknowledged_by uuid references platform_users (id),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);

create table incident_tenants (
  incident_id uuid not null references incidents (id) on delete cascade,
  tenant_id uuid not null references tenants (id) on delete cascade,
  primary key (incident_id, tenant_id)
);

create index incidents_status_idx on incidents (status);

-- ---------------------------------------------------------------------------
-- Audit log — §13: "double-logged" (platform + that tenant's own audit trail)
-- ---------------------------------------------------------------------------
-- One table, two visibility flags, instead of two separate logs to keep in
-- sync. `visible_to_tenant` is what the Hotel Admin's own audit view filters
-- on — this is how a hotel sees "platform staff looked at your account".
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_platform_user_id uuid references platform_users (id),
  tenant_id uuid references tenants (id),
  action text not null,            -- e.g. 'tenant.suspend', 'impersonation.start'
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  visible_to_tenant boolean not null default false
);

create index audit_log_tenant_idx on audit_log (tenant_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- All writes to these tables go through server-side API routes using the
-- Supabase SERVICE ROLE key (which bypasses RLS) — this schema's RLS exists
-- to make the tables safe to also query directly from trusted server
-- contexts using the anon/authenticated key, and as defense-in-depth.
-- Cross-population access (a tenant-side auth user reading these tables) is
-- blocked entirely: none of these policies grant access based on anything
-- other than a verified row in platform_users.

alter table platform_users enable row level security;
alter table tenants enable row level security;
alter table impersonation_sessions enable row level security;
alter table incidents enable row level security;
alter table incident_tenants enable row level security;
alter table audit_log enable row level security;

-- Helper: is the current authenticated user a known platform user?
create or replace function is_platform_user()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from platform_users where auth_user_id = auth.uid()
  );
$$;

create policy "platform users can read platform_users"
  on platform_users for select
  using (is_platform_user());

create policy "platform users can read all tenants"
  on tenants for select
  using (is_platform_user());

create policy "platform users can read impersonation sessions"
  on impersonation_sessions for select
  using (is_platform_user());

create policy "platform users can read incidents"
  on incidents for select
  using (is_platform_user());

create policy "platform users can read incident_tenants"
  on incident_tenants for select
  using (is_platform_user());

-- Tenant-side audit view: a hotel's own staff should be able to read the
-- subset of audit_log rows marked visible_to_tenant for their own tenant_id.
-- This assumes a `tenant_memberships(auth_user_id, tenant_id)` table exists
-- on the tenant side (out of scope of this doc) — wire the `using` clause to
-- however that side identifies "this user belongs to this tenant".
create policy "platform users can read all audit_log"
  on audit_log for select
  using (is_platform_user());

-- No insert/update/delete policies are defined for authenticated roles on
-- purpose: mutations happen exclusively through server-side API routes using
-- the service role key, where application logic enforces the reason-code,
-- TTL, and type-to-confirm rules described in the spec.

-- ---------------------------------------------------------------------------
-- Hardening applied after running Supabase's advisors against a live
-- instance of this schema — folded back in here so a fresh deploy starts
-- clean instead of needing the same follow-up migrations.
-- ---------------------------------------------------------------------------
alter function public.is_platform_user() set search_path = public, pg_temp;
revoke execute on function public.is_platform_user() from public;
grant execute on function public.is_platform_user() to authenticated;

create index audit_log_actor_idx on audit_log (actor_platform_user_id);
create index incident_tenants_tenant_idx on incident_tenants (tenant_id);
create index incidents_acknowledged_by_idx on incidents (acknowledged_by);
create index tenants_suspended_by_idx on tenants (suspended_by);

-- ---------------------------------------------------------------------------
-- Self-service business registration — business_type + tenant_memberships
-- ---------------------------------------------------------------------------
-- Business type drives starter templates per the IA doc; wasn't in the
-- original schema since only the platform-admin side had been built.
create type business_type as enum ('hotel', 'restaurant', 'medical_clinic', 'school', 'retail', 'other');

alter table tenants add column business_type business_type not null default 'other';

-- Links a business-side Supabase Auth user to the tenant(s) they belong to.
-- This is the tenant-side equivalent of platform_users — a SEPARATE
-- population, never conflated with it (see require-platform.ts / the
-- population-separation design note in DEPLOYMENT.md).
create type tenant_member_role as enum ('owner', 'admin', 'agent');

create table tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  tenant_id uuid not null references tenants (id) on delete cascade,
  role tenant_member_role not null default 'owner',
  created_at timestamptz not null default now(),
  unique (auth_user_id, tenant_id)
);

create index tenant_memberships_auth_user_idx on tenant_memberships (auth_user_id);
create index tenant_memberships_tenant_idx on tenant_memberships (tenant_id);

alter table tenant_memberships enable row level security;

-- A tenant-side user can see their own membership rows (not other tenants').
create policy "members can read their own memberships"
  on tenant_memberships for select
  using (auth_user_id = auth.uid());

-- A tenant-side user can read their own tenant's row (not other tenants').
-- Additive to the existing "platform users can read all tenants" policy —
-- RLS policies are OR'd together, so a platform user still sees everything,
-- and a business user additionally sees their own.
create policy "members can read their own tenant"
  on tenants for select
  using (
    exists (
      select 1 from tenant_memberships
      where tenant_memberships.tenant_id = tenants.id
        and tenant_memberships.auth_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Knowledge Base — document storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create table documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  uploaded_by uuid references auth.users (id) on delete set null,
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
  -- No "status: indexed/processing" column — no AI indexing pipeline
  -- exists in this build. A document is either successfully uploaded or
  -- the insert failed outright.
);

create index documents_tenant_idx on documents (tenant_id, created_at desc);

alter table documents enable row level security;

create policy "members can read their tenant's documents"
  on documents for select
  using (
    exists (
      select 1 from tenant_memberships
      where tenant_memberships.tenant_id = documents.tenant_id
        and tenant_memberships.auth_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- AI Assistant identity — name, avatar, tone
-- ---------------------------------------------------------------------------
-- Deliberately NOT here: any actual AI/LLM configuration (model, system
-- prompt, knowledge-base wiring) — there's no AI orchestrator in this
-- build, so there's nothing for those settings to configure yet.
alter table tenants add column assistant_name text not null default 'Assistant';
alter table tenants add column assistant_avatar text not null default '🤖';
alter table tenants add column assistant_tone text not null default 'warm_casual'
  check (assistant_tone in ('warm_casual', 'formal', 'playful'));
