import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformUser } from "@/lib/auth/require-platform";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";

const SuspendSchema = z.object({ reason: z.string().min(1) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Suspend is one of the highest-blast-radius actions on the platform
  // (spec §13/§19) — scoped to admins and support engineers only, not
  // billing_ops or auditor, even though both of those roles can *see* the
  // tenant table.
  const guard = await requirePlatformUser(["platform_admin", "support_engineer"]);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = SuspendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "missing_reason" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();

  const { data: tenant, error: fetchError } = await admin
    .from("tenants")
    .select("id, name, status")
    .eq("id", id)
    .single();

  if (fetchError || !tenant) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (tenant.status === "suspended") {
    return NextResponse.json({ error: "already_suspended" }, { status: 409 });
  }

  const { data: updated, error: updateError } = await admin
    .from("tenants")
    .update({
      status: "suspended",
      suspended_at: new Date().toISOString(),
      suspended_reason: parsed.data.reason,
      suspended_by: guard.platformUser.id
    })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  // Double-logged per spec §13: platform's own trail, and visible to the
  // hotel's own admins in their audit view — transparency cuts both ways.
  await writeAuditLog({
    actorPlatformUserId: guard.platformUser.id,
    tenantId: tenant.id,
    action: "tenant.suspend",
    reason: parsed.data.reason,
    visibleToTenant: true
  });

  // Actually cutting off the tenant's guest-facing endpoints is an async
  // job elsewhere in the platform (spec's user journey §9 notes "within
  // minutes"), not this route's job — this route only owns the status
  // transition + audit trail.

  return NextResponse.json({ tenant: updated });
}
