import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantMember } from "@/lib/auth/require-tenant-member";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET() {
  const guard = await requireTenantMember();
  if (!guard.ok) return guard.response;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("rules")
    .select("*")
    .eq("tenant_id", guard.tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  return NextResponse.json({ rules: data ?? [] });
}

const CreateSchema = z.object({
  condition_description: z.string().min(1).max(300),
  action_description: z.string().min(1).max(300)
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
  const { data: rule, error } = await admin
    .from("rules")
    .insert({
      tenant_id: guard.tenantId,
      condition_description: parsed.data.condition_description,
      action_description: parsed.data.action_description
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ rule }, { status: 201 });
}
