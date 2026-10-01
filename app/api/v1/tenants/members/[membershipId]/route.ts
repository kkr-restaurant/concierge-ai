import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantMember } from "@/lib/auth/require-tenant-member";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

async function countOwners(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  tenantId: string
) {
  const { count } = await admin
    .from("tenant_memberships")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("role", "owner");
  return count ?? 0;
}

const UpdateSchema = z.object({ role: z.enum(["owner", "admin", "agent"]) });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  const { membershipId } = await params;
  const guard = await requireTenantMember(["owner", "admin"]);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();

  const { data: target, error: fetchError } = await admin
    .from("tenant_memberships")
    .select("id, tenant_id, role")
    .eq("id", membershipId)
    .eq("tenant_id", guard.tenantId) // can't touch another tenant's row
    .single();

  if (fetchError || !target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Only an owner can hand out or take away the owner role itself.
  if ((target.role === "owner" || parsed.data.role === "owner") && guard.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Don't let the last owner demote themselves (or be demoted) — would
  // leave the tenant with no one able to manage ownership-level settings.
  if (target.role === "owner" && parsed.data.role !== "owner") {
    const owners = await countOwners(admin, guard.tenantId);
    if (owners <= 1) {
      return NextResponse.json({ error: "last_owner" }, { status: 409 });
    }
  }

  const { data: updated, error: updateError } = await admin
    .from("tenant_memberships")
    .update({ role: parsed.data.role })
    .eq("id", membershipId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ membership: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  const { membershipId } = await params;
  const guard = await requireTenantMember(["owner", "admin"]);
  if (!guard.ok) return guard.response;

  const admin = createAdminSupabaseClient();

  const { data: target, error: fetchError } = await admin
    .from("tenant_memberships")
    .select("id, tenant_id, role")
    .eq("id", membershipId)
    .eq("tenant_id", guard.tenantId)
    .single();

  if (fetchError || !target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (target.role === "owner" && guard.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (target.role === "owner") {
    const owners = await countOwners(admin, guard.tenantId);
    if (owners <= 1) {
      return NextResponse.json({ error: "last_owner" }, { status: 409 });
    }
  }

  const { error: deleteError } = await admin
    .from("tenant_memberships")
    .delete()
    .eq("id", membershipId);

  if (deleteError) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
