import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function writeAuditLog(entry: {
  actorPlatformUserId: string;
  tenantId?: string;
  action: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  visibleToTenant?: boolean;
}) {
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("audit_log").insert({
    actor_platform_user_id: entry.actorPlatformUserId,
    tenant_id: entry.tenantId ?? null,
    action: entry.action,
    reason: entry.reason ?? null,
    metadata: entry.metadata ?? {},
    visible_to_tenant: entry.visibleToTenant ?? false
  });

  // Deliberately not thrown: a failed audit-log write shouldn't roll back
  // an already-applied mutation (e.g. a tenant that's genuinely suspended),
  // but it must be loud somewhere real monitoring will see it.
  if (error) {
    console.error("audit_log write failed", entry.action, error);
  }
}
