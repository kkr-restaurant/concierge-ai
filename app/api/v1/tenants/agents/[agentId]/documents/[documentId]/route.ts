import { NextResponse } from "next/server";
import { requireAgentAccess } from "@/lib/auth/require-agent-access";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string; documentId: string }> }
) {
  const { agentId, documentId } = await params;
  const guard = await requireAgentAccess(agentId);
  if (!guard.ok) return guard.response;

  const admin = createAdminSupabaseClient();
  const { data: doc, error } = await admin
    .from("documents")
    .select("storage_path, file_name")
    .eq("id", documentId)
    .eq("agent_id", agentId) // must belong to THIS agent, not just this tenant
    .single();

  if (error || !doc) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Bucket is private — a short-lived signed URL is the only way to let the
  // browser actually download the file.
  const { data: signed, error: signError } = await admin.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, 60);

  if (signError || !signed) {
    return NextResponse.json({ error: "sign_failed" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl, file_name: doc.file_name });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ agentId: string; documentId: string }> }
) {
  const { agentId, documentId } = await params;
  const guard = await requireAgentAccess(agentId);
  if (!guard.ok) return guard.response;

  const admin = createAdminSupabaseClient();
  const { data: doc, error: fetchError } = await admin
    .from("documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("agent_id", agentId)
    .single();

  if (fetchError || !doc) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await admin.storage.from("documents").remove([doc.storage_path]);

  const { error: deleteError } = await admin.from("documents").delete().eq("id", documentId);
  if (deleteError) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
