import { NextResponse } from "next/server";
import { requirePlatformUser } from "@/lib/auth/require-platform";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const guard = await requirePlatformUser();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const admin = createAdminSupabaseClient();
  let query = admin
    .from("incidents")
    .select("*, incident_tenants(tenant_id)")
    .order("first_seen", { ascending: false });

  if (status) query = query.in("status", status.split(","));

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const incidents = (data ?? []).map((row) => ({
    id: row.id,
    severity: row.severity,
    title: row.title,
    description: row.description,
    status: row.status,
    first_seen: row.first_seen,
    acknowledged_by: row.acknowledged_by,
    acknowledged_at: row.acknowledged_at,
    resolved_at: row.resolved_at,
    affected_tenants: (row as { incident_tenants?: { tenant_id: string }[] })
      .incident_tenants?.length ?? 0
  }));

  return NextResponse.json({ incidents });
}
