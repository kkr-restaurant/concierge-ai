import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAgentAccess } from "@/lib/auth/require-agent-access";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { CAPABILITY_KEYS, CHANNEL_KEYS } from "@/lib/agent-options";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const guard = await requireAgentAccess(agentId);
  if (!guard.ok) return guard.response;

  return NextResponse.json({ agent: guard.agent, role: guard.role });
}

const UpdateSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  avatar: z.string().min(1).max(8).optional(),
  tone: z.enum(["warm_casual", "formal", "playful"]).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(["draft", "live"]).optional(),
  capabilities: z.array(z.enum(CAPABILITY_KEYS)).optional(),
  channels: z.array(z.enum(CHANNEL_KEYS)).optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const guard = await requireAgentAccess(agentId, ["owner", "admin"]);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data: agent, error } = await admin
    .from("agents")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", agentId)
    .eq("tenant_id", guard.tenantId)
    .select()
    .single();

  if (error || !agent) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ agent });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const guard = await requireAgentAccess(agentId, ["owner", "admin"]);
  if (!guard.ok) return guard.response;

  const admin = createAdminSupabaseClient();

  // Deleting the agent row cascades to its documents/workflows/rules ROWS in
  // Postgres — but the actual uploaded files live in Supabase Storage, which
  // a DB cascade cannot reach. Remove them first, or they'd be orphaned
  // there permanently (unreferenced, invisible in the UI, still stored).
  const { data: docs } = await admin
    .from("documents")
    .select("storage_path")
    .eq("agent_id", agentId);

  const paths = (docs ?? []).map((d) => d.storage_path);
  if (paths.length > 0) {
    await admin.storage.from("documents").remove(paths);
  }

  const { error } = await admin
    .from("agents")
    .delete()
    .eq("id", agentId)
    .eq("tenant_id", guard.tenantId);

  if (error) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
