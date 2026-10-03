import { NextResponse } from "next/server";
import { requireTenantMember } from "@/lib/auth/require-tenant-member";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  const { integrationId } = await params;
  const guard = await requireTenantMember(["owner", "admin"]);
  if (!guard.ok) return guard.response;

  const admin = createAdminSupabaseClient();
  const { error, count } = await admin
    .from("integrations")
    .delete({ count: "exact" })
    .eq("id", integrationId)
    .eq("tenant_id", guard.tenantId);

  if (error || !count) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
