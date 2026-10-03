import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantMember } from "@/lib/auth/require-tenant-member";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function maskKey(key: string | null): string | null {
  if (!key) return null;
  if (key.length <= 4) return "••••";
  return `••••${key.slice(-4)}`;
}

export async function GET() {
  const guard = await requireTenantMember();
  if (!guard.ok) return guard.response;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("integrations")
    .select("id, name, webhook_url, api_key, created_at")
    .eq("tenant_id", guard.tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  // Never send the real key back once it's saved — only a masked preview,
  // same principle as a credit-card-last-4 display.
  const integrations = (data ?? []).map((row) => ({
    ...row,
    api_key: maskKey(row.api_key),
    has_api_key: Boolean(row.api_key)
  }));

  return NextResponse.json({ integrations });
}

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  webhook_url: z.string().url().optional().or(z.literal("")),
  api_key: z.string().max(500).optional().or(z.literal(""))
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
  const { data: integration, error } = await admin
    .from("integrations")
    .insert({
      tenant_id: guard.tenantId,
      name: parsed.data.name,
      webhook_url: parsed.data.webhook_url || null,
      api_key: parsed.data.api_key || null
    })
    .select("id, name, webhook_url, api_key, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json(
    {
      integration: {
        ...integration,
        api_key: maskKey(integration.api_key),
        has_api_key: Boolean(integration.api_key)
      }
    },
    { status: 201 }
  );
}
