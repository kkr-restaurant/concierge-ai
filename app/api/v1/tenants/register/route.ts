import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const RegisterSchema = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase, numbers, and hyphens only"),
  business_type: z.enum(["hotel", "restaurant", "medical_clinic", "school", "retail", "other"]),
  plan: z.enum(["starter", "pro", "enterprise"]).optional()
  // Deliberately NOT accepted here: channels, uploaded documents, connected
  // systems. The onboarding wizard still shows those steps for continuity
  // with the original design, but nothing backs them yet — no channels,
  // documents, or integrations tables exist in the schema. Persisting them
  // would mean silently discarding data the user thinks was saved, which is
  // worse than not offering the field. See DEPLOYMENT.md.
});

/**
 * Step 2 of self-service signup. Step 1 (creating the actual Supabase Auth
 * account) happens client-side via supabase.auth.signUp() — this route only
 * runs once that succeeded and the browser has a real session, and its job
 * is narrow: create the tenant row and link the calling user to it as
 * 'owner'. Requires only an authenticated user, not a platform user.
 */
export async function POST(request: Request) {
  const guard = await requireAuthenticatedUser();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const admin = createAdminSupabaseClient();

  // One tenant per signup for now — if this user already owns a tenant,
  // point that out rather than silently creating a second one.
  const { data: existingMembership } = await admin
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("auth_user_id", guard.userId)
    .maybeSingle();

  if (existingMembership) {
    return NextResponse.json({ error: "already_registered" }, { status: 409 });
  }

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      business_type: parsed.data.business_type,
      plan: parsed.data.plan ?? "starter"
      // status defaults to 'trial' in the schema — every self-service
      // signup starts on the 15-day trial, matching the IA doc.
    })
    .select()
    .single();

  if (tenantError) {
    if (tenantError.code === "23505") {
      return NextResponse.json({ error: "slug_taken" }, { status: 409 });
    }
    return NextResponse.json({ error: "tenant_create_failed" }, { status: 500 });
  }

  const { error: membershipError } = await admin.from("tenant_memberships").insert({
    auth_user_id: guard.userId,
    tenant_id: tenant.id,
    role: "owner"
  });

  if (membershipError) {
    // Tenant exists but the membership link failed -- clean up rather than
    // leave an orphaned tenant nobody can access.
    await admin.from("tenants").delete().eq("id", tenant.id);
    return NextResponse.json({ error: "membership_create_failed" }, { status: 500 });
  }

  return NextResponse.json({ tenant }, { status: 201 });
}
