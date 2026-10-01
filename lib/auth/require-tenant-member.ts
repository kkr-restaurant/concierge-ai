import "server-only";
import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type TenantMemberRole = "owner" | "admin" | "agent";

type Guarded =
  | { ok: true; userId: string; tenantId: string; role: TenantMemberRole }
  | { ok: false; response: NextResponse };

/**
 * Guard for endpoints scoped to "a member of some tenant" — Users and
 * Settings pages, not the open signup flow (that only needs
 * requireAuthenticatedUser, since there's no membership yet at that point).
 *
 * Each user belongs to at most one tenant in this build (enforced at
 * registration — see /api/v1/tenants/register), so there's no tenantId
 * parameter to disambiguate; this always resolves "their" tenant.
 */
export async function requireTenantMember(
  allowedRoles?: TenantMemberRole[]
): Promise<Guarded> {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data: membership, error } = await admin
    .from("tenant_memberships")
    .select("tenant_id, role")
    .eq("auth_user_id", auth.userId)
    .maybeSingle();

  if (error || !membership) {
    return {
      ok: false,
      response: NextResponse.json({ error: "no_tenant" }, { status: 404 })
    };
  }

  if (allowedRoles && !allowedRoles.includes(membership.role as TenantMemberRole)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 })
    };
  }

  return {
    ok: true,
    userId: auth.userId,
    tenantId: membership.tenant_id,
    role: membership.role as TenantMemberRole
  };
}
