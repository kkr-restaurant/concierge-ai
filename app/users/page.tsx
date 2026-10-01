"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash2, X } from "lucide-react";
import BusinessSidebar from "@/app/_components/BusinessSidebar";

type Member = {
  id: string;
  email: string;
  role: "owner" | "admin" | "agent";
  created_at: string;
  is_you: boolean;
};

export default function UsersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "agent">("agent");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/v1/tenants/members");
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
    if (res.status === 404) {
      router.replace("/signup");
      return;
    }
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members);
    } else {
      setAuthError(true);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const me = members.find((m) => m.is_you);
  const canManage = me?.role === "owner" || me?.role === "admin";

  async function submitInvite() {
    setInviteError(null);
    if (!inviteEmail.trim()) {
      setInviteError("Enter an email address.");
      return;
    }
    setInviting(true);
    const res = await fetch("/api/v1/tenants/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole })
    });
    setInviting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      if (body?.error === "already_registered") {
        setInviteError("That email already has an account.");
      } else {
        setInviteError("Couldn't send the invite — try again.");
      }
      return;
    }

    showToast(`Invited ${inviteEmail}.`);
    setInviteOpen(false);
    setInviteEmail("");
    setInviteRole("agent");
    load();
  }

  async function changeRole(membershipId: string, role: Member["role"]) {
    const res = await fetch(`/api/v1/tenants/members/${membershipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      showToast(
        body?.error === "last_owner"
          ? "Can't change the only owner's role."
          : "Couldn't update role."
      );
      return;
    }
    load();
  }

  async function removeMember(membershipId: string, email: string) {
    if (!confirm(`Remove ${email} from this business?`)) return;
    const res = await fetch(`/api/v1/tenants/members/${membershipId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      showToast(
        body?.error === "last_owner" ? "Can't remove the only owner." : "Couldn't remove member."
      );
      return;
    }
    showToast(`Removed ${email}.`);
    load();
  }

  if (authError) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-ink text-fg">
        <p className="text-danger text-sm">Something went wrong loading your team.</p>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-ink text-fg">
      <BusinessSidebar current="/users" />
      <main className="flex-1 p-8 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-xl font-medium">Users</h1>
            <p className="text-muted text-sm">Who has access to this business</p>
          </div>
          {canManage && (
            <button
              onClick={() => setInviteOpen(true)}
              className="flex items-center gap-2 text-sm bg-brass text-ink font-medium rounded-md px-3 py-2"
            >
              <UserPlus size={15} /> Invite teammate
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-muted text-sm">Loading…</p>
        ) : (
          <div className="bg-surface border border-border rounded-card overflow-hidden">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0"
              >
                <div>
                  <p className="text-sm">
                    {m.email} {m.is_you && <span className="text-muted">(you)</span>}
                  </p>
                  <p className="text-xs text-muted">
                    Joined {new Date(m.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {canManage && !m.is_you ? (
                    <select
                      value={m.role}
                      onChange={(e) => changeRole(m.id, e.target.value as Member["role"])}
                      className="bg-surface2 border border-border rounded-md text-xs px-2 py-1"
                    >
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                      <option value="agent">Agent</option>
                    </select>
                  ) : (
                    <span className="text-xs text-muted capitalize px-2">{m.role}</span>
                  )}
                  {canManage && !m.is_you && (
                    <button
                      onClick={() => removeMember(m.id, m.email)}
                      className="text-muted hover:text-danger"
                      aria-label={`Remove ${m.email}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {inviteOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-border rounded-card p-6 max-w-sm w-full relative">
            <button
              onClick={() => setInviteOpen(false)}
              className="absolute right-4 top-4 text-muted hover:text-fg"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <h2 className="font-display text-lg font-medium mb-4">Invite a teammate</h2>

            {inviteError && (
              <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-md px-3 py-2 mb-3">
                {inviteError}
              </div>
            )}

            <label className="text-xs text-muted mb-1 block">Email</label>
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teammate@yourbusiness.com"
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm mb-3"
            />

            <label className="text-xs text-muted mb-1 block">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "admin" | "agent")}
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm mb-6"
            >
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>

            <button
              onClick={submitInvite}
              disabled={inviting}
              className="w-full bg-brass text-ink font-medium text-sm rounded-md py-2.5 disabled:opacity-60"
            >
              {inviting ? "Sending…" : "Send invite"}
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-surface2 border border-border rounded-md px-4 py-2.5 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
