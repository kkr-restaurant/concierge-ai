import { NextResponse } from "next/server";
import { requirePlatformUser } from "@/lib/auth/require-platform";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await requirePlatformUser(["platform_admin", "support_engineer"]);
  if (!guard.ok) return guard.response;

  const admin = createAdminSupabaseClient();

  const { data: tenant, error: fetchError } = await admin
    .from("tenants")
    .select("id, status")
    .eq("id", id)
    .single();

  if (fetchError || !tenant) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (tenant.status !== "suspended") {
    return NextResponse.json({ error: "not_suspended" }, { status: 409 });
  }

  const { data: updated, error: updateError } = await admin
    .from("tenants")
    .update({
      status: "active",
      suspended_at: null,
      suspended_reason: null,
      suspended_by: null
    })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  await writeAuditLog({
    actorPlatformUserId: guard.platformUser.id,
    tenantId: tenant.id,
    action: "tenant.reactivate",
    visibleToTenant: true
  });

  return NextResponse.json({ tenant: updated });
}
