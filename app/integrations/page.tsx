"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X, Key, Link as LinkIcon } from "lucide-react";
import BusinessSidebar from "@/app/_components/BusinessSidebar";

type Integration = {
  id: string;
  name: string;
  webhook_url: string | null;
  api_key: string | null; // already masked by the API
  has_api_key: boolean;
  created_at: string;
};

export default function IntegrationsPage() {
  const router = useRouter();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const [intRes, meRes] = await Promise.all([
      fetch("/api/v1/tenants/integrations"),
      fetch("/api/v1/tenants/me")
    ]);
    if (intRes.status === 401) {
      router.replace("/login");
      return;
    }
    if (intRes.status === 404) {
      router.replace("/signup");
      return;
    }
    if (intRes.ok) setIntegrations((await intRes.json()).integrations);
    if (meRes.ok) setRole((await meRes.json()).role);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const canEdit = role === "owner" || role === "admin";

  async function createIntegration() {
    setCreateError(null);
    if (!name.trim()) {
      setCreateError("Give it a name.");
      return;
    }
    if (webhookUrl.trim() && !/^https?:\/\//.test(webhookUrl.trim())) {
      setCreateError("Webhook URL must start with http:// or https://");
      return;
    }
    setCreating(true);
    const res = await fetch("/api/v1/tenants/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        webhook_url: webhookUrl.trim(),
        api_key: apiKey.trim()
      })
    });
    setCreating(false);

    if (!res.ok) {
      setCreateError("Couldn't save — check the fields and try again.");
      return;
    }
    setCreateOpen(false);
    setName("");
    setWebhookUrl("");
    setApiKey("");
    showToast("Integration saved.");
    load();
  }

  async function deleteIntegration(integration: Integration) {
    if (!confirm(`Remove "${integration.name}"?`)) return;
    const res = await fetch(`/api/v1/tenants/integrations/${integration.id}`, {
      method: "DELETE"
    });
    if (!res.ok) {
      showToast("Couldn't remove.");
      return;
    }
    showToast(`"${integration.name}" removed.`);
    load();
  }

  return (
    <div className="flex min-h-screen bg-ink text-fg">
      <BusinessSidebar current="/integrations" />
      <main className="flex-1 p-8 max-w-2xl">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="font-display text-xl font-medium">Integrations</h1>
            <p className="text-muted text-sm">Connect the systems you already run on</p>
          </div>
          {canEdit && (
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 text-sm bg-brass text-ink font-medium rounded-md px-3 py-2"
            >
              <Plus size={15} /> Add integration
            </button>
          )}
        </div>
        <p className="text-xs text-muted mb-6">
          This stores connection details only — nothing in this build actually calls these systems
          yet. API keys are masked after saving and can&apos;t be viewed again; remove and re-add to
          change one.
        </p>

        {loading ? (
          <p className="text-muted text-sm">Loading…</p>
        ) : integrations.length === 0 ? (
          <p className="text-muted text-sm text-center py-6">No integrations added yet.</p>
        ) : (
          <div className="bg-surface border border-border rounded-card overflow-hidden">
            {integrations.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm">{i.name}</p>
                  <div className="flex items-center gap-3 text-xs text-muted mt-0.5">
                    {i.webhook_url && (
                      <span className="flex items-center gap-1 truncate max-w-[220px]">
                        <LinkIcon size={11} /> {i.webhook_url}
                      </span>
                    )}
                    {i.has_api_key && (
                      <span className="flex items-center gap-1">
                        <Key size={11} /> {i.api_key}
                      </span>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <button
                    onClick={() => deleteIntegration(i)}
                    className="text-muted hover:text-danger flex-shrink-0"
                    aria-label={`Remove ${i.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
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
            <h2 className="font-display text-lg font-medium mb-4">Add an integration</h2>

            {createError && (
              <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-md px-3 py-2 mb-3">
                {createError}
              </div>
            )}

            <label className="text-xs text-muted mb-1 block">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="POS System"
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm mb-3"
            />

            <label className="text-xs text-muted mb-1 block">Webhook URL (optional)</label>
            <input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-system.com/webhook"
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm mb-3 font-mono"
            />

            <label className="text-xs text-muted mb-1 block">API key (optional)</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk_live_…"
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm mb-6 font-mono"
            />

            <button
              onClick={createIntegration}
              disabled={creating}
              className="w-full bg-brass text-ink font-medium text-sm rounded-md py-2.5 disabled:opacity-60"
            >
              {creating ? "Saving…" : "Save"}
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
