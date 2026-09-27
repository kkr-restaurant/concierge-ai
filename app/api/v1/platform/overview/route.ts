import { NextResponse } from "next/server";
import { requirePlatformUser } from "@/lib/auth/require-platform";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Spec §14: "KPI overview cached 30s server-side, shared across concurrent
// admin sessions." Next.js Route Handlers on the edge don't get a free
// shared in-memory cache across requests the way a long-lived Node process
// would, so this uses Next's `revalidate` (backed by the platform's cache
// API) rather than an in-process variable, which would not be shared
// across Worker isolates.
export const revalidate = 30;

export async function GET() {
  const guard = await requirePlatformUser();
  if (!guard.ok) return guard.response;

  const admin = createAdminSupabaseClient();

  const [tenantsCount, incidentsCount, nearLimitCount, todayCount] =
    await Promise.all([
      admin
        .from("tenants")
        .select("id", { count: "exact", head: true })
        .in("status", ["active", "trial", "at_risk"]),
      admin
        .from("incidents")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      admin
        .from("tenants")
        .select("id", { count: "exact", head: true })
        .eq("status", "at_risk"),
      // "Conversations today" belongs to the conversation-analytics module,
      // which isn't part of this schema — stubbed at 0 until that module's
      // table/materialized-view exists. Left explicit rather than faked.
      Promise.resolve({ count: 0 })
    ]);

  return NextResponse.json({
    kpis: {
      active_tenants: tenantsCount.count ?? 0,
      conversations_today: todayCount.count ?? 0,
      open_incidents: incidentsCount.count ?? 0,
      tenants_near_limit: nearLimitCount.count ?? 0
    }
  });
}
