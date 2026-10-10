import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated";
import { requireTenantMember } from "@/lib/auth/require-tenant-member";
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

const UpdateSettingsSchema = z.object({
  name: z.string().min(1).optional(),
  business_type: z
    .enum(["hotel", "restaurant", "medical_clinic", "school", "retail", "other"])
    .optional(),
  // Deliberately not editable here: slug (used as an identifier elsewhere;
  // changing it is a bigger decision than a quick settings edit) and plan
  // (plan changes belong to a real billing/upgrade flow, which doesn't
  // exist yet — exposing a plan dropdown here would silently change
  // billing-relevant state with no payment flow behind it).
  //
  // (Assistant name/avatar/tone used to be editable here. They moved to the
  // per-agent model — each agent has its own — so those columns no longer
  // exist on tenants.)
});

export async function PATCH(request: Request) {
  const guard = await requireTenantMember(["owner", "admin"]);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = UpdateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data: tenant, error } = await admin
    .from("tenants")
    .update(parsed.data)
    .eq("id", guard.tenantId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ tenant });
}

const DeleteSchema = z.object({ confirm_name: z.string() });

export async function DELETE(request: Request) {
  // Owner only — the same restriction the platform-admin suspend flow uses
  // for its highest-blast-radius action; deleting the whole business is at
  // least that serious.
  const guard = await requireTenantMember(["owner"]);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "confirmation_required" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();

  const { data: tenant, error: fetchError } = await admin
    .from("tenants")
    .select("id, name")
    .eq("id", guard.tenantId)
    .single();

  if (fetchError || !tenant) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (parsed.data.confirm_name !== tenant.name) {
    return NextResponse.json({ error: "name_mismatch" }, { status: 400 });
  }

  // tenant_memberships has ON DELETE CASCADE on tenant_id, so this also
  // removes every membership row for this tenant in one statement.
  const { error: deleteError } = await admin.from("tenants").delete().eq("id", tenant.id);

  if (deleteError) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
