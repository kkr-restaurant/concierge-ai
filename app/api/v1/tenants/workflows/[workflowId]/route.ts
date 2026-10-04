import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantMember } from "@/lib/auth/require-tenant-member";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const UpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  trigger_description: z.string().min(1).max(300).optional(),
  status: z.enum(["draft", "active"]).optional(),
  // Loosely validated on purpose — this is @xyflow/react's node/edge shape,
  // which has many optional fields (position, style, handle ids, etc.)
  // that aren't worth re-declaring here. The canvas library owns that
  // shape; this route just persists whatever it produces.
  definition: z
    .object({
      nodes: z.array(z.record(z.string(), z.unknown())),
      edges: z.array(z.record(z.string(), z.unknown()))
    })
    .optional()
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  const { workflowId } = await params;
  const guard = await requireTenantMember();
  if (!guard.ok) return guard.response;

  const admin = createAdminSupabaseClient();
  const { data: workflow, error } = await admin
    .from("workflows")
    .select("*")
    .eq("id", workflowId)
    .eq("tenant_id", guard.tenantId)
    .single();

  if (error || !workflow) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ workflow });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  const { workflowId } = await params;
  const guard = await requireTenantMember(["owner", "admin"]);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data: workflow, error } = await admin
    .from("workflows")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", workflowId)
    .eq("tenant_id", guard.tenantId) // can't touch another tenant's workflow
    .select()
    .single();

  if (error || !workflow) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ workflow });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  const { workflowId } = await params;
  const guard = await requireTenantMember(["owner", "admin"]);
  if (!guard.ok) return guard.response;

  const admin = createAdminSupabaseClient();
  const { error, count } = await admin
    .from("workflows")
    .delete({ count: "exact" })
    .eq("id", workflowId)
    .eq("tenant_id", guard.tenantId);

  if (error || !count) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
