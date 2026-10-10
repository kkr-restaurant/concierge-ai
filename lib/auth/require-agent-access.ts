import "server-only";
import { NextResponse } from "next/server";
import {
  requireTenantMember,
  type TenantMemberRole
} from "@/lib/auth/require-tenant-member";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type AgentRow = {
  id: string;
  tenant_id: string;
  name: string;
  avatar: string;
  tone: "warm_casual" | "formal" | "playful";
  description: string;
  status: "draft" | "live";
  capabilities: string[];
  channels: string[];
  created_at: string;
  updated_at: string;
};

type Guarded =
  | {
      ok: true;
      userId: string;
      tenantId: string;
      role: TenantMemberRole;
      agent: AgentRow;
    }
  | { ok: false; response: NextResponse };

/**
 * Guard for every route nested under /api/v1/tenants/agents/[agentId]/...
 *
 * Two checks in one: (1) the caller is a member of a tenant (optionally with
 * a specific role), and (2) the agent named in the URL belongs to THAT
 * tenant. Without (2), a member of tenant A could pass tenant B's agent id
 * and read or modify B's documents/workflows/rules — the admin Supabase
 * client bypasses RLS, so this app-level check is the only thing standing
 * between tenants on these routes. A foreign or nonexistent agent id returns
 * 404 (not 403) so the response doesn't confirm that the id exists.
 */
export async function requireAgentAccess(
  agentId: string,
  allowedRoles?: TenantMemberRole[]
): Promise<Guarded> {
  const guard = await requireTenantMember(allowedRoles);
  if (!guard.ok) return guard;

  const admin = createAdminSupabaseClient();
  const { data: agent, error } = await admin
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .eq("tenant_id", guard.tenantId)
    .maybeSingle();

  if (error || !agent) {
    return {
      ok: false,
      response: NextResponse.json({ error: "agent_not_found" }, { status: 404 })
    };
  }

  return {
    ok: true,
    userId: guard.userId,
    tenantId: guard.tenantId,
    role: guard.role,
    agent: agent as AgentRow
  };
}
