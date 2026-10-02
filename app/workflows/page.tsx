"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import BusinessSidebar from "@/app/_components/BusinessSidebar";

type Workflow = {
  id: string;
  name: string;
  trigger_description: string;
  status: "draft" | "active";
  created_at: string;
};

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const [wfRes, meRes] = await Promise.all([
      fetch("/api/v1/tenants/workflows"),
      fetch("/api/v1/tenants/me")
    ]);
    if (wfRes.status === 401) {
      router.replace("/login");
      return;
    }
    if (wfRes.status === 404) {
      router.replace("/signup");
      return;
    }
    if (wfRes.ok) setWorkflows((await wfRes.json()).workflows);
    if (meRes.ok) setRole((await meRes.json()).role);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const canEdit = role === "owner" || role === "admin";

  async function createWorkflow() {
    setCreateError(null);
    if (!name.trim() || !trigger.trim()) {
      setCreateError("Fill in both fields.");
      return;
    }
    setCreating(true);
    const res = await fetch("/api/v1/tenants/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), trigger_description: trigger.trim() })
    });
    setCreating(false);

    if (!res.ok) {
      setCreateError("Couldn't create — try again.");
      return;
    }
    setCreateOpen(false);
    setName("");
    setTrigger("");
    showToast("Workflow created as draft.");
    load();
  }

  async function toggleStatus(wf: Workflow) {
    const nextStatus = wf.status === "active" ? "draft" : "active";
    const res = await fetch(`/api/v1/tenants/workflows/${wf.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
    if (!res.ok) {
      showToast("Couldn't update status.");
      return;
    }
    load();
  }

  async function deleteWorkflow(wf: Workflow) {
    if (!confirm(`Delete "${wf.name}"?`)) return;
    const res = await fetch(`/api/v1/tenants/workflows/${wf.id}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Couldn't delete.");
      return;
    }
    showToast(`"${wf.name}" deleted.`);
    load();
  }

  return (
    <div className="flex min-h-screen bg-ink text-fg">
      <BusinessSidebar current="/workflows" />
      <main className="flex-1 p-8 max-w-2xl">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="font-display text-xl font-medium">Workflows</h1>
            <p className="text-muted text-sm">
              Automations your assistant will follow once it&apos;s connected
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 text-sm bg-brass text-ink font-medium rounded-md px-3 py-2"
            >
              <Plus size={15} /> New workflow
            </button>
          )}
        </div>
        <p className="text-xs text-muted mb-6">
          Nothing executes these yet — there&apos;s no AI orchestrator in this build. This defines
          what should happen once one exists.
        </p>

        {loading ? (
          <p className="text-muted text-sm">Loading…</p>
        ) : workflows.length === 0 ? (
          <p className="text-muted text-sm text-center py-6">No workflows yet.</p>
        ) : (
          <div className="bg-surface border border-border rounded-card overflow-hidden">
            {workflows.map((wf) => (
              <div
                key={wf.id}
                className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm">{wf.name}</p>
                  <p className="text-xs text-muted truncate">Trigger: {wf.trigger_description}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {canEdit ? (
                    <button
                      onClick={() => toggleStatus(wf)}
                      className={`text-xs px-2 py-1 rounded-md border ${
                        wf.status === "active"
                          ? "text-success border-success bg-success/10"
                          : "text-muted border-border"
                      }`}
                    >
                      {wf.status === "active" ? "Active" : "Draft"}
                    </button>
                  ) : (
                    <span className="text-xs text-muted capitalize">{wf.status}</span>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => deleteWorkflow(wf)}
                      className="text-muted hover:text-danger"
                      aria-label={`Delete ${wf.name}`}
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

      {createOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-border rounded-card p-6 max-w-sm w-full relative">
            <button
              onClick={() => setCreateOpen(false)}
              className="absolute right-4 top-4 text-muted hover:text-fg"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <h2 className="font-display text-lg font-medium mb-4">New workflow</h2>

            {createError && (
              <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-md px-3 py-2 mb-3">
                {createError}
              </div>
            )}

            <label className="text-xs text-muted mb-1 block">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Book a table"
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm mb-3"
            />

            <label className="text-xs text-muted mb-1 block">Trigger</label>
            <input
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              placeholder="Guest asks to reserve a table"
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm mb-6"
            />

            <button
              onClick={createWorkflow}
              disabled={creating}
              className="w-full bg-brass text-ink font-medium text-sm rounded-md py-2.5 disabled:opacity-60"
            >
              {creating ? "Creating…" : "Create"}
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
