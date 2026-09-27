import { NextResponse } from "next/server";
import { requirePlatformUser } from "@/lib/auth/require-platform";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const guard = await requirePlatformUser();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });

  const admin = createAdminSupabaseClient();

  const tenantResults = admin
    .from("tenants")
    .select("id, name, slug")
    .or(`name.ilike.%${q}%,slug.ilike.%${q}%,id.eq.${q}`)
    .limit(10);

  // Emails are only searchable by platform_admin — spec §4: "cross-tenant
  // search ... user emails ... for Platform Admins only. Never conversation
  // content."
  const userResults =
    guard.platformUser.role === "platform_admin"
      ? admin.from("platform_users").select("id, name, email").ilike("email", `%${q}%`).limit(10)
      : Promise.resolve({ data: [], error: null });

  const [{ data: tenants }, { data: users }] = await Promise.all([
    tenantResults,
    userResults
  ]);

  const results = [
    ...(tenants ?? []).map((t) => ({
      type: "tenant" as const,
      id: t.id,
      label: t.name,
      sublabel: t.slug
    })),
    ...(users ?? []).map((u) => ({
      type: "user" as const,
      id: u.id,
      label: u.name,
      sublabel: u.email
    }))
  ];

  return NextResponse.json({ results });
}
