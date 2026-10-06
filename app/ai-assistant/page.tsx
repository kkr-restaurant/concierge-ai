"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import BusinessSidebar from "@/app/_components/BusinessSidebar";

type Tenant = {
  name: string;
  assistant_name: string;
  assistant_avatar: string;
  assistant_tone: "warm_casual" | "formal" | "playful";
};

const TONES = [
  { value: "warm_casual", label: "Warm & casual" },
  { value: "formal", label: "Formal" },
  { value: "playful", label: "Playful" }
] as const;

export default function AiAssistantPage() {
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [tone, setTone] = useState<Tenant["assistant_tone"]>("warm_casual");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [testMessage, setTestMessage] = useState("");
  const [testLog, setTestLog] = useState<{ from: "user" | "bot"; text: string }[]>([]);
  const [sending, setSending] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/v1/tenants/me");
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
      setTenant(data.tenant);
      setRole(data.role);
      setName(data.tenant.assistant_name);
      setAvatar(data.tenant.assistant_avatar);
      setTone(data.tenant.assistant_tone);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const canEdit = role === "owner" || role === "admin";

  async function save() {
    setSaving(true);
    const res = await fetch("/api/v1/tenants/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assistant_name: name,
        assistant_avatar: avatar,
        assistant_tone: tone
      })
    });
    setSaving(false);

    if (!res.ok) {
      showToast("Couldn't save — try again.");
      return;
    }
    showToast("Assistant identity saved.");
  }

  async function sendTestMessage() {
    const message = testMessage.trim();
    if (!message || sending) return;

    const history = testLog.map((entry) => ({
      role: entry.from === "user" ? ("user" as const) : ("assistant" as const),
      content: entry.text
    }));

    setTestLog((log) => [...log, { from: "user", text: message }]);
    setTestMessage("");
    setSending(true);

    const res = await fetch("/api/v1/tenants/ai-assistant/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history })
    });

    setSending(false);

    if (!res.ok) {
      setTestLog((log) => [
        ...log,
        { from: "bot", text: "Something went wrong getting a response — try again." }
      ]);
      return;
    }

    const data = await res.json();
    setTestLog((log) => [...log, { from: "bot", text: data.reply }]);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-ink text-fg">
        <p className="text-muted text-sm">Loading…</p>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-ink text-fg">
      <BusinessSidebar current="/ai-assistant" businessName={tenant?.name} />
      <main className="flex-1 p-8">
        <h1 className="font-display text-xl font-medium mb-1">AI Assistant</h1>
        <p className="text-muted text-sm mb-6">
          Your assistant&apos;s identity — name, avatar, and tone — plus a real conversation,
          running on Cloudflare Workers AI. It doesn&apos;t know your actual hours, menu, or
          policies yet — Knowledge Base, Workflows, and Rules aren&apos;t connected to it — but the
          conversation itself is real, not scripted.
        </p>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
          <div className="bg-surface border border-border rounded-card p-5">
            <label className="text-xs text-muted mb-1 block">Assistant name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit}
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm mb-4 disabled:opacity-60"
            />

            <label className="text-xs text-muted mb-1 block">Avatar (emoji)</label>
            <input
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              disabled={!canEdit}
              maxLength={8}
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm mb-4 disabled:opacity-60"
            />

            <label className="text-xs text-muted mb-1 block">Tone</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as Tenant["assistant_tone"])}
              disabled={!canEdit}
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm mb-6 disabled:opacity-60"
            >
              {TONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            {canEdit && (
              <button
                onClick={save}
                disabled={saving}
                className="w-full bg-brass text-ink font-medium text-sm rounded-md py-2.5 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            )}
          </div>

          <div className="bg-surface border border-border rounded-card p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{avatar}</span>
              <span className="text-sm font-medium">{name}</span>
              <span className="text-xs text-success ml-auto">● live</span>
            </div>
            <div className="flex-1 bg-surface2 rounded-md p-3 mb-3 min-h-[180px] max-h-[260px] overflow-y-auto flex flex-col gap-2">
              {testLog.length === 0 && (
                <p className="text-xs text-muted text-center my-auto">
                  Type a message below to see how it&apos;s handled.
                </p>
              )}
              {testLog.map((entry, i) => (
                <div
                  key={i}
                  className={`text-sm px-3 py-2 rounded-md max-w-[85%] ${
                    entry.from === "user"
                      ? "bg-brass/15 text-brass self-end"
                      : "bg-surface text-muted self-start"
                  }`}
                >
                  {entry.text}
                </div>
              ))}
              {sending && (
                <div className="text-sm px-3 py-2 rounded-md max-w-[85%] bg-surface text-muted self-start">
                  …
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !sending && sendTestMessage()}
                placeholder="Type a message…"
                disabled={sending}
                className="flex-1 bg-surface2 border border-border rounded-md px-3 py-2 text-sm disabled:opacity-60"
              />
              <button
                onClick={sendTestMessage}
                disabled={sending}
                className="bg-brass text-ink rounded-md px-3 disabled:opacity-60"
                aria-label="Send"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-surface2 border border-border rounded-md px-4 py-2.5 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
