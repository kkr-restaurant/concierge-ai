import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET() {
  const guard = await requireAuthenticatedUser();
  if (!guard.ok) return guard.response;

  const admin = createAdminSupabaseClient();

  const { data: membership, error: membershipError } = await admin
    .from("tenant_memberships")
    .select("role, tenant:tenants(*)")
    .eq("auth_user_id", guard.userId)
    .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.json({ error: "no_tenant" }, { status: 404 });
  }

  return NextResponse.json({ tenant: membership.tenant, role: membership.role });
}
