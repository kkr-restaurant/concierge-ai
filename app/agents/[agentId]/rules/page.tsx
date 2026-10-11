"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X, ArrowRight } from "lucide-react";
import BusinessSidebar from "@/app/_components/BusinessSidebar";

type Rule = {
  id: string;
  condition_description: string;
  action_description: string;
  is_active: boolean;
  created_at: string;
};

export default function RulesPage() {
  const router = useRouter();
  const [rules, setRules] = useState<Rule[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [condition, setCondition] = useState("");
  const [action, setAction] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const [rulesRes, meRes] = await Promise.all([
      fetch("/api/v1/tenants/rules"),
      fetch("/api/v1/tenants/me")
    ]);
    if (rulesRes.status === 401) {
      router.replace("/login");
      return;
    }
    if (rulesRes.status === 404) {
      router.replace("/signup");
      return;
    }
    if (rulesRes.ok) setRules((await rulesRes.json()).rules);
    if (meRes.ok) setRole((await meRes.json()).role);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const canEdit = role === "owner" || role === "admin";

  async function createRule() {
    setCreateError(null);
    if (!condition.trim() || !action.trim()) {
      setCreateError("Fill in both fields.");
      return;
    }
    setCreating(true);
    const res = await fetch("/api/v1/tenants/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        condition_description: condition.trim(),
        action_description: action.trim()
      })
    });
    setCreating(false);

    if (!res.ok) {
      setCreateError("Couldn't create — try again.");
      return;
    }
    setCreateOpen(false);
    setCondition("");
    setAction("");
    showToast("Rule created.");
    load();
  }

  async function toggleActive(rule: Rule) {
    const res = await fetch(`/api/v1/tenants/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !rule.is_active })
    });
    if (!res.ok) {
      showToast("Couldn't update rule.");
      return;
    }
    load();
  }

  async function deleteRule(rule: Rule) {
    if (!confirm("Delete this rule?")) return;
    const res = await fetch(`/api/v1/tenants/rules/${rule.id}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Couldn't delete.");
      return;
    }
    showToast("Rule deleted.");
    load();
  }

  return (
    <div className="flex min-h-screen bg-ink text-fg">
      <BusinessSidebar current="/rules" />
      <main className="flex-1 p-8 max-w-2xl">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="font-display text-xl font-medium">Rules</h1>
            <p className="text-muted text-sm">Condition-based behaviors for your assistant</p>
          </div>
          {canEdit && (
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 text-sm bg-brass text-ink font-medium rounded-md px-3 py-2"
            >
              <Plus size={15} /> New rule
            </button>
          )}
        </div>
        <p className="text-xs text-muted mb-6">
          Nothing evaluates these yet — there&apos;s no AI orchestrator in this build. This defines
          what should happen once one exists.
        </p>

        {loading ? (
          <p className="text-muted text-sm">Loading…</p>
        ) : rules.length === 0 ? (
          <p className="text-muted text-sm text-center py-6">No rules yet.</p>
        ) : (
          <div className="bg-surface border border-border rounded-card overflow-hidden">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0 gap-3"
              >
                <div className="flex items-center gap-2 text-sm min-w-0">
                  <span className="truncate">{rule.condition_description}</span>
                  <ArrowRight size={13} className="text-muted flex-shrink-0" />
                  <span className="truncate text-muted">{rule.action_description}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {canEdit ? (
                    <button
                      onClick={() => toggleActive(rule)}
                      className={`text-xs px-2 py-1 rounded-md border ${
                        rule.is_active
                          ? "text-success border-success bg-success/10"
                          : "text-muted border-border"
                      }`}
                    >
                      {rule.is_active ? "Active" : "Inactive"}
                    </button>
                  ) : (
                    <span className="text-xs text-muted">{rule.is_active ? "Active" : "Inactive"}</span>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => deleteRule(rule)}
                      className="text-muted hover:text-danger"
                      aria-label="Delete rule"
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
            <h2 className="font-display text-lg font-medium mb-4">New rule</h2>

            {createError && (
              <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-md px-3 py-2 mb-3">
                {createError}
              </div>
            )}

            <label className="text-xs text-muted mb-1 block">If…</label>
            <input
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="Guest asks about a refund"
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm mb-3"
            />

            <label className="text-xs text-muted mb-1 block">Then…</label>
            <input
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="Escalate to staff"
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm mb-6"
            />

            <button
              onClick={createRule}
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
