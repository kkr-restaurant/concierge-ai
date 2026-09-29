import "server-only";
import { NextResponse } from "next/server";
import { decodeJwt } from "jose";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type PlatformRole =
  | "platform_admin"
  | "support_engineer"
  | "platform_ops"
  | "billing_ops"
  | "auditor";

export type PlatformUser = {
  id: string;
  auth_user_id: string;
  name: string;
  email: string;
  role: PlatformRole;
};

type Guarded =
  | { ok: true; platformUser: PlatformUser }
  | { ok: false; response: NextResponse };

/**
 * Population + role guard for every /api/v1/platform/* route.
 *
 * Two independent checks, on purpose (spec §13 — "rejected at the gateway,
 * not merely permission-checked"):
 *   1. The session's JWT must carry `population: "platform"` — a custom
 *      claim stamped by the `custom_access_token_hook` in
 *      supabase/auth-hook.sql, present only for users with a row in
 *      platform_users. A tenant-side token never has this claim, so it's
 *      rejected here before any query runs.
 *   2. We still look the user up in platform_users via the admin client —
 *      catches a revoked platform user whose existing token hasn't expired
 *      yet (claims are only refreshed on token refresh, not instantly).
 *
 * `allowedRoles` narrows further for endpoints that only some platform
 * roles should reach (e.g. suspend/impersonate are platform_admin +
 * support_engineer only, not billing_ops or auditor).
 */
export async function requirePlatformUser(
  allowedRoles?: PlatformRole[]
): Promise<Guarded> {
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

  // Custom claim check — see supabase/auth-hook.sql.
  //
  // IMPORTANT: this must read the JWT itself (session.access_token), not
  // session.user.app_metadata. Those are two different things — GoTrue's
  // token response includes a `user` object that mirrors the actual
  // auth.users.raw_app_meta_data DB column, separate from the signed JWT
  // whose claims the access-token hook modifies. session.user.app_metadata
  // reflects the DB row (which we never touch), so it will never show the
  // hook's injected population claim — only decoding the token itself does.
  let population: unknown;
  try {
    const claims = decodeJwt(session.access_token) as {
      app_metadata?: Record<string, unknown>;
    };
    population = claims.app_metadata?.population;
  } catch {
    population = undefined;
  }
  if (population !== "platform") {
    return {
      ok: false,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 })
    };
  }

  const admin = createAdminSupabaseClient();
  const { data: platformUser, error } = await admin
    .from("platform_users")
    .select("id, auth_user_id, name, email, role")
    .eq("auth_user_id", session.user.id)
    .single();

  if (error || !platformUser) {
    return {
      ok: false,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 })
    };
  }

  if (allowedRoles && !allowedRoles.includes(platformUser.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 })
    };
  }

  return { ok: true, platformUser: platformUser as PlatformUser };
}
