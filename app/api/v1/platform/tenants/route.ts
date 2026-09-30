import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformUser } from "@/lib/auth/require-platform";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 50; // spec §14: capped server-side regardless of client ask

export async function GET(request: Request) {
  const guard = await requirePlatformUser();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const plan = searchParams.get("plan");
  const sort = searchParams.get("sort") ?? "name.asc";
  const cursor = searchParams.get("cursor"); // base64 of last row's `name,id`

  const admin = createAdminSupabaseClient();
  let query = admin.from("tenants").select("*", { count: "exact" });

  if (q) {
    query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%`);
  }
  if (status) query = query.in("status", status.split(","));
  if (plan) query = query.in("plan", plan.split(","));

  const [sortField, sortDir] = sort.split(".");
  query = query.order(sortField ?? "name", { ascending: sortDir !== "desc" });

  if (cursor) {
    const decoded = Buffer.from(cursor, "base64").toString("utf-8");
    const [, lastId] = decoded.split(",");
    // Simple keyset pagination on id as a stable tiebreaker.
    query = query.gt("id", lastId);
  }

  query = query.limit(PAGE_SIZE);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const nextCursor =
    data && data.length === PAGE_SIZE
      ? Buffer.from(`${data[data.length - 1].name},${data[data.length - 1].id}`).toString(
          "base64"
        )
      : null;

  return NextResponse.json({ tenants: data ?? [], next_cursor: nextCursor });
}

const CreateTenantSchema = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase, numbers, and hyphens only"),
  // No .default() here on purpose — "trial" isn't a valid value of this
  // enum (plan is starter/pro/enterprise; "trial" is a *status*, not a
  // plan), so a default of "trial" would make parsing fail the moment plan
  // is omitted. The actual default to "starter" happens below, after
  // validation, where it can't break parsing.
  plan: z.enum(["starter", "pro", "enterprise"]).optional()
});

export async function POST(request: Request) {
  const guard = await requirePlatformUser(["platform_admin"]);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = CreateTenantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("tenants")
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      plan: parsed.data.plan ?? "starter"
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "slug_taken" }, { status: 409 });
    }
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ tenant: data }, { status: 201 });
}
