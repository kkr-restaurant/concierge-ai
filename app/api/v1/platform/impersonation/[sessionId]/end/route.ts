import { NextResponse } from "next/server";
import { requirePlatformUser } from "@/lib/auth/require-platform";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const guard = await requirePlatformUser();
  if (!guard.ok) return guard.response;

  const admin = createAdminSupabaseClient();

  const { data: session, error: fetchError } = await admin
    .from("impersonation_sessions")
    .select("id, tenant_id, platform_user_id, ended_at")
    .eq("id", sessionId)
    .single();

  if (fetchError || !session) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!session.ended_at) {
    await admin
      .from("impersonation_sessions")
      .update({ ended_at: new Date().toISOString(), ended_reason: "manual" })
      .eq("id", session.id);

    await writeAuditLog({
      actorPlatformUserId: guard.platformUser.id,
      tenantId: session.tenant_id,
      action: "impersonation.end",
      metadata: { session_id: session.id, ended_reason: "manual" },
      visibleToTenant: true
    });
  }

  return new NextResponse(null, { status: 204 });
}
