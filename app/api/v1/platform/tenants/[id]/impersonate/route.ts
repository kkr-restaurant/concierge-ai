import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformUser } from "@/lib/auth/require-platform";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";
import { signImpersonationToken } from "@/lib/auth/impersonation-token";

const ImpersonateSchema = z.object({
  reason_code: z.enum(["bug_reproduction", "support_ticket", "onboarding", "other"]),
  reason_note: z.string().optional()
});

const SESSION_TTL_MINUTES = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await requirePlatformUser(["platform_admin", "support_engineer"]);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = ImpersonateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "missing_reason" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("id, name")
    .eq("id", id)
    .single();
  if (tenantError || !tenant) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000);

  const { data: session, error: sessionError } = await admin
    .from("impersonation_sessions")
    .insert({
      platform_user_id: guard.platformUser.id,
      tenant_id: tenant.id,
      reason_code: parsed.data.reason_code,
      reason_note: parsed.data.reason_note ?? null,
      expires_at: expiresAt.toISOString()
    })
    .select()
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "session_create_failed" }, { status: 500 });
  }

  // The token itself proves nothing beyond "this session row exists and
  // hasn't expired" — the tenant-side app must still check the
  // impersonation_sessions row (ended_at IS NULL, expires_at > now()) on
  // every request, not just trust the token's own exp claim, so that
  // ending a session early (see .../impersonation/[sessionId]/end)
  // actually revokes access immediately rather than waiting for the JWT to
  // expire on its own.
  const token = await signImpersonationToken(
    {
      sessionId: session.id,
      tenantId: tenant.id,
      platformUserId: guard.platformUser.id
    },
    expiresAt
  );

  await writeAuditLog({
    actorPlatformUserId: guard.platformUser.id,
    tenantId: tenant.id,
    action: "impersonation.start",
    reason: parsed.data.reason_code,
    metadata: { reason_note: parsed.data.reason_note, session_id: session.id },
    visibleToTenant: true
  });

  return NextResponse.json({
    impersonation_token: token,
    session_id: session.id,
    expires_at: expiresAt.toISOString()
  });
}
