import "server-only";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Guarded =
  | { ok: true; userId: string; email: string | null }
  | { ok: false; response: NextResponse };

/**
 * Guard for endpoints any signed-in business-side user can call — the
 * tenant-side equivalent of requirePlatformUser(), but with no population
 * or role check, since a brand-new signup has no tenant_memberships row
 * yet (that's what /api/v1/tenants/register is for creating).
 */
export async function requireAuthenticatedUser(): Promise<Guarded> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "unauthenticated" }, { status: 401 })
    };
  }

  return { ok: true, userId: session.user.id, email: session.user.email ?? null };
}
