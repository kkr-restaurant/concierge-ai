"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import BusinessSidebar from "@/app/_components/BusinessSidebar";
import AgentTabs from "@/app/_components/AgentTabs";
import AgentChat from "@/app/_components/AgentChat";
import { CAPABILITIES, CHANNELS, TONES } from "@/lib/agent-options";

type Agent = {
  id: string;
  name: string;
  avatar: string;
  tone: "warm_casual" | "formal" | "playful";
  description: string;
  status: "draft" | "live";
  capabilities: string[];
  channels: string[];
};

export default function AgentOverviewPage() {
  const router = useRouter();
  const { agentId } = useParams<{ agentId: string }>();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [tone, setTone] = useState<Agent["tone"]>("warm_casual");
  const [description, setDescription] = useState("");
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [channels, setChannels] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async () => {
    const res = await fetch(`/api/v1/tenants/agents/${agentId}`);
    if (res.status === 401) return router.replace("/login");
    if (res.status === 404) return router.replace("/agents");
    if (res.ok) {
      const data = await res.json();
      const a: Agent = data.agent;
      setAgent(a);
      setRole(data.role);
      setName(a.name);
      setAvatar(a.avatar);
      setTone(a.tone);
      setDescription(a.description);
      setCapabilities(a.capabilities);
      setChannels(a.channels);
    }
    setLoading(false);
  }, [agentId, router]);

  useEffect(() => {
    load();
  }, [load]);

  const canEdit = role === "owner" || role === "admin";

  function toggle(list: string[], setList: (v: string[]) => void, key: string) {
    setList(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  }

  async function patch(body: Record<string, unknown>, okMessage: string) {
    setSaving(true);
    const res = await fetch(`/api/v1/tenants/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    setSaving(false);
    if (!res.ok) {
      showToast("Couldn't save — try again.");
      return;
    }
    const data = await res.json();
    setAgent(data.agent);
    showToast(okMessage);
  }

  async function saveAll() {
    if (!name.trim()) return showToast("Name can't be empty.");
    await patch(
      { name: name.trim(), avatar, tone, description: description.trim(), capabilities, channels },
      "Saved."
    );
  }

  async function deleteAgent() {
    if (!agent || confirmName !== agent.name) return;
    setDeleting(true);
    const res = await fetch(`/api/v1/tenants/agents/${agentId}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) return showToast("Couldn't delete — try again.");
    router.push("/agents");
  }

  if (loading || !agent) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-ink text-fg">
        <p className="text-muted text-sm">Loading…</p>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-ink text-fg">
      <BusinessSidebar current="/agents" />
      <main className="flex-1 p-8 max-w-5xl">
        <AgentTabs
          agentId={agentId}
          active="overview"
          agentName={agent.name}
          agentAvatar={agent.avatar}
          status={agent.status}
        />

        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <div className="bg-surface border border-border rounded-card p-5 mb-5">
              <h2 className="text-sm font-medium mb-4">Identity</h2>
              <label className="text-xs text-muted mb-1 block">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEdit}
                className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm mb-3 disabled:opacity-60"
              />
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-muted mb-1 block">Avatar</label>
                  <input
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    disabled={!canEdit}
                    maxLength={8}
                    className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value as Agent["tone"])}
                    disabled={!canEdit}
                    className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm disabled:opacity-60"
                  >
                    {TONES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="text-xs text-muted mb-1 block">What this agent does</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!canEdit}
                rows={3}
                maxLength={500}
                className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>

            <div className="bg-surface border border-border rounded-card p-5 mb-5">
              <h2 className="text-sm font-medium mb-1">Capabilities</h2>
              <p className="text-xs text-muted mb-3">
                Instructions for what it helps with and declines. It can&apos;t actually perform
                these actions — no systems are connected.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {CAPABILITIES.map((c) => (
                  <ToggleChip
                    key={c.key}
                    on={capabilities.includes(c.key)}
                    disabled={!canEdit}
                    onClick={() => toggle(capabilities, setCapabilities, c.key)}
                  >
                    {c.icon} {c.label}
                  </ToggleChip>
                ))}
              </div>
            </div>

            <div className="bg-surface border border-border rounded-card p-5 mb-5">
              <h2 className="text-sm font-medium mb-1">Channels</h2>
              <p className="text-xs text-muted mb-3">
                Recorded preference only — none of these are actually connected yet.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {CHANNELS.map((c) => (
                  <ToggleChip
                    key={c.key}
                    on={channels.includes(c.key)}
                    disabled={!canEdit}
                    onClick={() => toggle(channels, setChannels, c.key)}
                  >
                    {c.icon} {c.label}
                  </ToggleChip>
                ))}
              </div>
            </div>

            {canEdit && (
              <div className="flex gap-2 mb-8">
                <button
                  onClick={saveAll}
                  disabled={saving}
                  className="flex-1 bg-brass text-ink font-medium text-sm rounded-md py-2.5 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  onClick={() =>
                    patch(
                      { status: agent.status === "live" ? "draft" : "live" },
                      agent.status === "live" ? "Set to draft." : "Agent is live."
                    )
                  }
                  disabled={saving}
                  className="border border-border rounded-md px-4 text-sm disabled:opacity-60"
                >
                  {agent.status === "live" ? "Set to draft" : "Go live"}
                </button>
              </div>
            )}
          </div>

          <div>
            <AgentChat agentId={agentId} agentName={agent.name} agentAvatar={agent.avatar} />
            <p className="text-xs text-muted mt-3">
              Chat uses the <b>saved</b> version of this agent — save changes first to test them.
              Active rules and .txt/.md/.csv knowledge files are included automatically.
            </p>
          </div>
        </div>

        {canEdit && (
          <div className="border border-danger/40 rounded-card p-5 max-w-xl mt-4">
            <h2 className="text-sm font-medium text-danger mb-2">Delete this agent</h2>
            <p className="text-xs text-muted mb-4">
              Permanently deletes {agent.name} along with all of its knowledge files, workflows, and
              rules. This can&apos;t be undone.
            </p>
            <label className="text-xs text-muted mb-1 block">
              Type <span className="text-fg">{agent.name}</span> to confirm
            </label>
            <input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              className="w-full bg-surface2 border border-danger/30 rounded-md px-3 py-2 text-sm mb-3"
            />
            <button
              onClick={deleteAgent}
              disabled={confirmName !== agent.name || deleting}
              className="w-full bg-danger text-white font-medium text-sm rounded-md py-2.5 disabled:opacity-40"
            >
              {deleting ? "Deleting…" : "Delete agent"}
            </button>
          </div>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-surface2 border border-border rounded-md px-4 py-2.5 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function ToggleChip({
  on,
  disabled,
  onClick,
  children
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={`text-left text-sm px-3 py-2.5 rounded-md border disabled:opacity-60 ${
        on ? "border-brass bg-brass/10 text-brass font-medium" : "border-border text-muted"
      }`}
    >
      {children}
    </button>
  );
}
