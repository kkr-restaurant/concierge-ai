import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAgentAccess } from "@/lib/auth/require-agent-access";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const guard = await requireAgentAccess(agentId);
  if (!guard.ok) return guard.response;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("workflows")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  return NextResponse.json({ workflows: data ?? [], role: guard.role });
}

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  trigger_description: z.string().min(1).max(300)
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const guard = await requireAgentAccess(agentId, ["owner", "admin"]);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const admin = createAdminSupabaseClient();
  const { data: workflow, error } = await admin
    .from("workflows")
    .insert({
      tenant_id: guard.tenantId,
      agent_id: agentId,
      name: parsed.data.name,
      trigger_description: parsed.data.trigger_description
      // status defaults to 'draft' — starts inactive until explicitly on.
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ workflow }, { status: 201 });
}
