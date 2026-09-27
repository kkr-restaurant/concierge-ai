import { NextResponse } from "next/server";
import { requirePlatformUser } from "@/lib/auth/require-platform";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await requirePlatformUser();
  if (!guard.ok) return guard.response;

  const admin = createAdminSupabaseClient();

  const { data: incident, error: fetchError } = await admin
    .from("incidents")
    .select("id, status")
    .eq("id", id)
    .single();

  if (fetchError || !incident) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (incident.status === "acknowledged") {
    return NextResponse.json({ error: "already_acknowledged" }, { status: 409 });
  }

  const { data: updated, error: updateError } = await admin
    .from("incidents")
    .update({
      status: "acknowledged",
      acknowledged_by: guard.platformUser.id,
      acknowledged_at: new Date().toISOString()
    })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ incident: updated });
}
