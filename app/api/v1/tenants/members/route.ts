import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantMember } from "@/lib/auth/require-tenant-member";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET() {
  const guard = await requireTenantMember();
  if (!guard.ok) return guard.response;

  const admin = createAdminSupabaseClient();
  const { data: memberships, error } = await admin
    .from("tenant_memberships")
    .select("id, auth_user_id, role, created_at")
    .eq("tenant_id", guard.tenantId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  // Emails live in auth.users, not tenant_memberships — look them up
  // individually via the admin API (no bulk "get users by ids" endpoint).
  const members = await Promise.all(
    (memberships ?? []).map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.auth_user_id);
      return {
        id: m.id,
        role: m.role,
        created_at: m.created_at,
        email: data.user?.email ?? "(unknown)",
        is_you: m.auth_user_id === guard.userId
      };
    })
  );

  return NextResponse.json({ members });
}

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "agent"]) // can't invite someone directly as owner
});

export async function POST(request: Request) {
  const guard = await requireTenantMember(["owner", "admin"]);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = InviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const admin = createAdminSupabaseClient();

  // Sends a real email via Supabase's configured mail system (same one
  // that delivered the signup confirmation email). NOTE: this app doesn't
  // yet have a dedicated "set your password" page for invited users — they
  // land on /dashboard already signed in via the invite link (Supabase's
  // client-side auto session detection picks up the token in the URL), but
  // have no password set until they use "Forgot password" separately. A
  // proper accept-invite flow is a reasonable next addition, not built here.
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    { redirectTo: `${new URL(request.url).origin}/dashboard` }
  );

  if (inviteError) {
    if (inviteError.message.toLowerCase().includes("already been registered")) {
      return NextResponse.json({ error: "already_registered" }, { status: 409 });
    }
    return NextResponse.json({ error: "invite_failed" }, { status: 500 });
  }

  const { error: membershipError } = await admin.from("tenant_memberships").insert({
    auth_user_id: invited.user.id,
    tenant_id: guard.tenantId,
    role: parsed.data.role
  });

  if (membershipError) {
    return NextResponse.json({ error: "membership_create_failed" }, { status: 500 });
  }

  return NextResponse.json({ invited: true, email: parsed.data.email }, { status: 201 });
}
