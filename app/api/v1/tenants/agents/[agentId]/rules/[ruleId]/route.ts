import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAgentAccess } from "@/lib/auth/require-agent-access";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const UpdateSchema = z.object({
  condition_description: z.string().min(1).max(300).optional(),
  action_description: z.string().min(1).max(300).optional(),
  is_active: z.boolean().optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ agentId: string; ruleId: string }> }
) {
  const { agentId, ruleId } = await params;
  const guard = await requireAgentAccess(agentId, ["owner", "admin"]);
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
    .eq("agent_id", agentId)
    .select()
    .single();

  if (error || !rule) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ rule });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ agentId: string; ruleId: string }> }
) {
  const { agentId, ruleId } = await params;
  const guard = await requireAgentAccess(agentId, ["owner", "admin"]);
  if (!guard.ok) return guard.response;

  const admin = createAdminSupabaseClient();
  const { error, count } = await admin
    .from("rules")
    .delete({ count: "exact" })
    .eq("id", ruleId)
    .eq("agent_id", agentId);

  if (error || !count) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
