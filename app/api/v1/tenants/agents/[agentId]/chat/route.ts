import { NextResponse } from "next/server";
import { z } from "zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireAgentAccess } from "@/lib/auth/require-agent-access";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { CAPABILITIES } from "@/lib/agent-options";

// Must be dynamic — getCloudflareContext() cannot run in a statically
// analyzed route (known opennextjs-cloudflare gotcha).
export const dynamic = "force-dynamic";

const MODEL = "@cf/meta/llama-3.3-70b-instruct";
const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_MESSAGES = 20;
const MAX_RESPONSE_TOKENS = 400;

// Knowledge is "stuffed" into the prompt, not retrieved via embeddings — fine
// for a handful of small files, and bounded so a big upload can't blow up
// the context window or the free-tier Neuron budget.
const MAX_KNOWLEDGE_DOCS = 5;
const MAX_CHARS_PER_DOC = 4000;
const MAX_KNOWLEDGE_CHARS = 8000;
const READABLE_MIME_TYPES = ["text/plain", "text/markdown", "text/csv"];

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const guard = await requireAgentAccess(agentId);
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
  const agent = guard.agent;

  const { data: tenant } = await admin
    .from("tenants")
    .select("name, business_type")
    .eq("id", guard.tenantId)
    .single();

  // --- Active rules: guidance on how to respond -------------------------
  const { data: rules } = await admin
    .from("rules")
    .select("condition_description, action_description")
    .eq("agent_id", agentId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(20);

  // --- Knowledge: read .txt/.md/.csv files, skip anything unreadable ----
  let knowledgeBlock = "";
  let readableDocCount = 0;
  try {
    const { data: docs } = await admin
      .from("documents")
      .select("file_name, storage_path, mime_type")
      .eq("agent_id", agentId)
      .in("mime_type", READABLE_MIME_TYPES)
      .order("created_at", { ascending: false })
      .limit(MAX_KNOWLEDGE_DOCS);

    let remaining = MAX_KNOWLEDGE_CHARS;
    for (const doc of docs ?? []) {
      if (remaining <= 0) break;
      const { data: blob, error } = await admin.storage
        .from("documents")
        .download(doc.storage_path);
      if (error || !blob) continue;
      const text = (await blob.text()).slice(0, Math.min(MAX_CHARS_PER_DOC, remaining));
      if (!text.trim()) continue;
      knowledgeBlock += `\n--- ${doc.file_name} ---\n${text}\n`;
      remaining -= text.length;
      readableDocCount++;
    }
  } catch {
    // A knowledge-loading failure must never break the conversation itself.
    knowledgeBlock = "";
    readableDocCount = 0;
  }

  // --- Build the system prompt ------------------------------------------
  const tone = TONE_DESCRIPTIONS[agent.tone] ?? TONE_DESCRIPTIONS.warm_casual;
  const businessType = (tenant?.business_type ?? "business").replace("_", " ");
  const enabled = CAPABILITIES.filter((c) => agent.capabilities.includes(c.key)).map(
    (c) => c.label
  );
  const disabled = CAPABILITIES.filter((c) => !agent.capabilities.includes(c.key)).map(
    (c) => c.label
  );

  const sections: string[] = [];

  sections.push(
    `You are ${agent.name}, an AI agent for ${tenant?.name ?? "this business"}, a ${businessType} business.` +
      (agent.description ? ` Your role: ${agent.description}` : "") +
      ` Respond in a ${tone} tone. Keep replies concise (2-4 sentences unless more detail is clearly needed).`
  );

  sections.push(
    `Scope of what you help with: ${enabled.length ? enabled.join(", ") : "general conversation only"}.` +
      (disabled.length
        ? ` You are NOT set up to: ${disabled.join(", ")}. If someone asks for one of those, politely say you can't help with that here.`
        : "")
  );

  // This is the honesty backstop. No order, booking, ticketing, or
  // escalation system is connected, so the model must never imply that it
  // actually did any of those things.
  sections.push(
    `IMPORTANT: You can only converse. You cannot actually create orders, book appointments, open support tickets, contact staff, or access any system — none are connected. Never claim or imply that you have done any of these. If asked, explain what the person would need to do or what information they would need to provide, and say a team member would have to complete it.`
  );

  if (rules && rules.length > 0) {
    sections.push(
      `Guidelines for how to respond (follow these):\n` +
        rules
          .map((r) => `- If ${r.condition_description}, then ${r.action_description}.`)
          .join("\n") +
        `\n(These tell you what to SAY or recommend. They do not let you take real actions.)`
    );
  }

  if (readableDocCount > 0) {
    sections.push(
      `Reference material from this business:${knowledgeBlock}\nUse this when it's relevant. If the answer isn't in it, say you don't know rather than guessing.`
    );
  } else {
    sections.push(
      `You have no reference material about this business's specific hours, menu, prices, or policies. If asked about specifics, say so honestly and suggest contacting the business directly — do not guess or make anything up.`
    );
  }

  const systemPrompt = sections.join("\n\n");

  // --- Call Workers AI --------------------------------------------------
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

  return NextResponse.json({
    reply: aiResponse.response,
    // Lets the UI show exactly what grounded this answer, instead of
    // implying more than was actually used.
    context: {
      knowledge_files_used: readableDocCount,
      active_rules_used: rules?.length ?? 0
    }
  });
}
