import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantMember } from "@/lib/auth/require-tenant-member";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const UpdateSchema = z.object({
  condition_description: z.string().min(1).max(300).optional(),
  action_description: z.string().min(1).max(300).optional(),
  is_active: z.boolean().optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  const { ruleId } = await params;
  const guard = await requireTenantMember(["owner", "admin"]);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data: rule, error } = await admin
    .from("rules")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", ruleId)
    .eq("tenant_id", guard.tenantId)
    .select()
    .single();

  if (error || !rule) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ rule });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  const { ruleId } = await params;
  const guard = await requireTenantMember(["owner", "admin"]);
  if (!guard.ok) return guard.response;

  const admin = createAdminSupabaseClient();
  const { error, count } = await admin
    .from("rules")
    .delete({ count: "exact" })
    .eq("id", ruleId)
    .eq("tenant_id", guard.tenantId);

  if (error || !count) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
