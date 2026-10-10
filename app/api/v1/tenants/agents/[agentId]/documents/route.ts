import { NextResponse } from "next/server";
import { requireAgentAccess } from "@/lib/auth/require-agent-access";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv"
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const guard = await requireAgentAccess(agentId);
  if (!guard.ok) return guard.response;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("documents")
    .select("id, file_name, mime_type, size_bytes, created_at")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  return NextResponse.json({ documents: data ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const guard = await requireAgentAccess(agentId);
  if (!guard.ok) return guard.response;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "unsupported_type" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();

  // "{tenant_id}/{agent_id}/{uuid}-{filename}" — each agent's files live
  // under their own prefix, and the uuid avoids collisions between two
  // uploads of the same filename.
  const storagePath = `${guard.tenantId}/${agentId}/${crypto.randomUUID()}-${file.name}`;

  const { error: uploadError } = await admin.storage
    .from("documents")
    .upload(storagePath, file, { contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }

  const { data: doc, error: insertError } = await admin
    .from("documents")
    .insert({
      tenant_id: guard.tenantId,
      agent_id: agentId,
      uploaded_by: guard.userId,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size
    })
    .select("id, file_name, mime_type, size_bytes, created_at")
    .single();

  if (insertError) {
    // Metadata insert failed after the file was already uploaded — clean up
    // the orphaned file rather than leave storage and the DB out of sync.
    await admin.storage.from("documents").remove([storagePath]);
    return NextResponse.json({ error: "metadata_insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ document: doc }, { status: 201 });
}
