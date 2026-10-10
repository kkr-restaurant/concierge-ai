import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantMember } from "@/lib/auth/require-tenant-member";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { CAPABILITY_KEYS, CHANNEL_KEYS } from "@/lib/agent-options";

export async function GET() {
  const guard = await requireTenantMember();
  if (!guard.ok) return guard.response;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("agents")
    .select("*")
    .eq("tenant_id", guard.tenantId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  return NextResponse.json({ agents: data ?? [], role: guard.role });
}

const CreateSchema = z.object({
  name: z.string().min(1).max(60),
  avatar: z.string().min(1).max(8).optional(),
  tone: z.enum(["warm_casual", "formal", "playful"]).optional(),
  description: z.string().max(500).optional(),
  capabilities: z.array(z.enum(CAPABILITY_KEYS)).optional(),
  channels: z.array(z.enum(CHANNEL_KEYS)).optional()
});

export async function POST(request: Request) {
  const guard = await requireTenantMember(["owner", "admin"]);
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
  const { data: agent, error } = await admin
    .from("agents")
    .insert({
      tenant_id: guard.tenantId,
      name: parsed.data.name,
      ...(parsed.data.avatar && { avatar: parsed.data.avatar }),
      ...(parsed.data.tone && { tone: parsed.data.tone }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.capabilities && { capabilities: parsed.data.capabilities }),
      ...(parsed.data.channels && { channels: parsed.data.channels })
      // status defaults to 'draft' in the schema — the wizard creates the
      // agent after step 1 so later steps (knowledge uploads etc.) have a
      // real agent row to attach to, and flips it to 'live' at Launch.
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ agent }, { status: 201 });
}
