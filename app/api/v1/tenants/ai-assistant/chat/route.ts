import { NextResponse } from "next/server";
import { z } from "zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireTenantMember } from "@/lib/auth/require-tenant-member";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Must be dynamic — getCloudflareContext() cannot run in a statically
// analyzed route (a known opennextjs-cloudflare gotcha: calling it in sync
// mode in a route Next.js hasn't already determined is dynamic throws
// during build).
export const dynamic = "force-dynamic";

const MODEL = "@cf/meta/llama-3.3-70b-instruct";
const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_MESSAGES = 20;
const MAX_RESPONSE_TOKENS = 300;

const ChatSchema = z.object({
  message: z.string().min(1).max(MAX_MESSAGE_LENGTH),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(MAX_MESSAGE_LENGTH)
      })
    )
    .max(MAX_HISTORY_MESSAGES)
    .optional()
});

const TONE_DESCRIPTIONS: Record<string, string> = {
  warm_casual: "warm, friendly, and conversational",
  formal: "professional and formal",
  playful: "upbeat, playful, and a little fun"
};

export async function POST(request: Request) {
  const guard = await requireTenantMember();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = ChatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const admin = createAdminSupabaseClient();
  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("name, business_type, assistant_name, assistant_tone")
    .eq("id", guard.tenantId)
    .single();

  if (tenantError || !tenant) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  const tone = TONE_DESCRIPTIONS[tenant.assistant_tone] ?? TONE_DESCRIPTIONS.warm_casual;
  const businessType = tenant.business_type.replace("_", " ");

  // Deliberately honest about what the assistant does NOT know. Nothing
  // wires the knowledge base, workflows, or rules into this prompt yet —
  // claiming otherwise would make the model fabricate business-specific
  // facts (hours, menu items, prices) it has no actual access to.
  const systemPrompt = `You are ${tenant.assistant_name}, an AI assistant for ${tenant.name}, a ${businessType} business. Respond in a ${tone} tone. Keep replies concise (2-4 sentences unless more detail is clearly needed).

You do NOT have access to this business's actual hours, menu, prices, bookings, policies, or any other specific details — none of that has been connected to you yet. If asked about specifics like these, say so honestly and suggest the person contact the business directly, rather than guessing or making something up.`;

  const { env } = await getCloudflareContext({ async: true });

  let aiResponse: { response?: string };
  try {
    aiResponse = (await env.AI.run(MODEL, {
      messages: [
        { role: "system", content: systemPrompt },
        ...(parsed.data.history ?? []),
        { role: "user", content: parsed.data.message }
      ],
      max_tokens: MAX_RESPONSE_TOKENS
    })) as { response?: string };
  } catch {
    return NextResponse.json({ error: "ai_request_failed" }, { status: 502 });
  }

  if (!aiResponse?.response) {
    return NextResponse.json({ error: "empty_response" }, { status: 502 });
  }

  return NextResponse.json({ reply: aiResponse.response });
}
