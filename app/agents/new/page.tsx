"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Upload, FileText, Check } from "lucide-react";
import BusinessSidebar from "@/app/_components/BusinessSidebar";
import AgentChat from "@/app/_components/AgentChat";
import { CAPABILITIES, CHANNELS, TONES } from "@/lib/agent-options";

const STEPS = ["Agent", "Knowledge", "Capabilities", "Channels", "Launch"];
const MAX_SIZE_MB = 10;

type Doc = { id: string; file_name: string; size_bytes: number };

export default function NewAgentPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [business, setBusiness] = useState<{ name: string; business_type: string } | null>(null);

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🤖");
  const [tone, setTone] = useState<"warm_casual" | "formal" | "playful">("warm_casual");
  const [description, setDescription] = useState("");
  const [capabilities, setCapabilities] = useState<string[]>(["answer_questions"]);
  const [channels, setChannels] = useState<string[]>(["web_widget"]);
  const [docs, setDocs] = useState<Doc[]>([]);

  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/v1/tenants/me").then(async (res) => {
      if (res.status === 401) return router.replace("/login");
      if (res.status === 404) return router.replace("/signup");
      if (res.ok) setBusiness((await res.json()).tenant);
    });
  }, [router]);

  function toggle(list: string[], setList: (v: string[]) => void, key: string) {
    setList(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  }

  // Step 1 → create (first time) or update (if they came back) the draft.
  async function saveIdentity() {
    setError(null);
    if (!name.trim()) {
      setError("Give your agent a name.");
      return;
    }
    setBusy(true);
    const payload = { name: name.trim(), avatar, tone, description: description.trim() };
    const res = agentId
      ? await fetch(`/api/v1/tenants/agents/${agentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      : await fetch("/api/v1/tenants/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
    setBusy(false);

    if (!res.ok) {
      setError(
        res.status === 403
          ? "Only an owner or admin can create agents."
          : "Couldn't save — try again."
      );
      return;
    }
    if (!agentId) setAgentId((await res.json()).agent.id);
    setStep(2);
  }

  async function uploadFile(file: File) {
    if (!agentId) return;
    setError(null);
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`${file.name} is over ${MAX_SIZE_MB}MB.`);
      return;
    }
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/v1/tenants/agents/${agentId}/documents`, {
      method: "POST",
      body: form
    });
    setUploading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(
        body?.error === "unsupported_type"
          ? `${file.name}: file type not supported.`
          : `Couldn't upload ${file.name}.`
      );
      return;
    }
    const { document } = await res.json();
    setDocs((d) => [document, ...d]);
  }

  async function patchAgent(body: Record<string, unknown>, next: number) {
    if (!agentId) return;
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/v1/tenants/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    setBusy(false);
    if (!res.ok) {
      setError("Couldn't save — try again.");
      return;
    }
    setStep(next);
  }

  async function launch() {
    if (!agentId) return;
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/v1/tenants/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "live" })
    });
    setBusy(false);
    if (!res.ok) {
      setError("Couldn't launch — try again.");
      return;
    }
    router.push(`/agents/${agentId}`);
  }

  const readable = docs.filter((d) => /\.(txt|md|csv)$/i.test(d.file_name)).length;

  return (
    <div className="flex min-h-screen bg-ink text-fg">
      <BusinessSidebar current="/agents" businessName={business?.name} />
      <main className="flex-1 p-8 max-w-3xl">
        <h1 className="font-display text-xl font-medium mb-1">Create an agent</h1>
        <p className="text-muted text-sm mb-6">
          {business ? `For ${business.name}` : "…"} · saved as a draft as you go
        </p>

        <div className="flex gap-2 mb-8">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const state = n < step ? "done" : n === step ? "active" : "todo";
            return (
              <div key={label} className="flex-1">
                <div
                  className={`h-1 rounded-full mb-1.5 ${
                    state === "todo" ? "bg-border" : "bg-brass"
                  }`}
                />
                <p
                  className={`text-xs ${
                    state === "active" ? "text-brass font-medium" : "text-muted"
                  }`}
                >
                  {n}. {label}
                </p>
              </div>
            );
          })}
        </div>

        {error && (
          <div
            role="alert"
            className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-md px-3 py-2 mb-5"
          >
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="bg-surface border border-border rounded-card p-5">
            {business && (
              <p className="text-xs text-muted mb-4">
                Business: <span className="text-fg">{business.name}</span> ·{" "}
                <span className="capitalize">{business.business_type.replace("_", " ")}</span>{" "}
                (change in Settings)
              </p>
            )}
            <label className="text-xs text-muted mb-1 block">Agent name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sales Agent"
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm mb-4"
            />
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-muted mb-1 block">Avatar (emoji)</label>
                <input
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  maxLength={8}
                  className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Tone</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as typeof tone)}
                  className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm"
                >
                  {TONES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label className="text-xs text-muted mb-1 block">What does this agent do?</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Answers product questions and recommends items to website visitors."
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm mb-5"
            />
            <button
              onClick={saveIdentity}
              disabled={busy}
              className="w-full bg-brass text-ink font-medium text-sm rounded-md py-2.5 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Continue"} {!busy && <ArrowRight size={15} />}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="bg-surface border border-border rounded-card p-5">
            <h2 className="text-sm font-medium mb-1">Knowledge</h2>
            <p className="text-xs text-muted mb-4">
              Upload files for this agent. It can currently <b>read .txt, .md, and .csv</b> files.
              PDF and Word files are stored but not yet readable by the agent. Website crawling and
              product catalogs aren&apos;t built.
            </p>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border rounded-md p-6 text-center cursor-pointer mb-3"
            >
              <Upload size={20} className="mx-auto mb-2 text-muted" />
              <p className="text-sm text-muted">
                {uploading ? "Uploading…" : "Click to choose a file"}
              </p>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.md,.csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadFile(f);
                  e.target.value = "";
                }}
              />
            </div>
            {docs.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-2 text-sm py-2 border-b border-border last:border-0"
              >
                <FileText size={14} className="text-brass" /> {d.file_name}
              </div>
            ))}
            <NavButtons
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
              nextLabel={docs.length ? "Continue" : "Skip for now"}
            />
          </div>
        )}

        {step === 3 && (
          <div className="bg-surface border border-border rounded-card p-5">
            <h2 className="text-sm font-medium mb-1">Capabilities</h2>
            <p className="text-xs text-muted mb-4">
              Tells the agent what it&apos;s there to help with, and what to decline. These are
              instructions only — the agent can&apos;t actually create orders, book appointments, or
              open tickets, because no systems are connected to it.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {CAPABILITIES.map((c) => (
                <Choice
                  key={c.key}
                  on={capabilities.includes(c.key)}
                  onClick={() => toggle(capabilities, setCapabilities, c.key)}
                >
                  {c.icon} {c.label}
                </Choice>
              ))}
            </div>
            <NavButtons
              onBack={() => setStep(2)}
              onNext={() => patchAgent({ capabilities }, 4)}
              busy={busy}
            />
          </div>
        )}

        {step === 4 && (
          <div className="bg-surface border border-border rounded-card p-5">
            <h2 className="text-sm font-medium mb-1">Channels</h2>
            <p className="text-xs text-muted mb-4">
              Where this agent is meant to be available. This records your choice — nothing is
              actually connected to WhatsApp, Instagram, email, or the others yet.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {CHANNELS.map((c) => (
                <Choice
                  key={c.key}
                  on={channels.includes(c.key)}
                  onClick={() => toggle(channels, setChannels, c.key)}
                >
                  {c.icon} {c.label}
                </Choice>
              ))}
            </div>
            <NavButtons
              onBack={() => setStep(3)}
              onNext={() => patchAgent({ channels }, 5)}
              busy={busy}
            />
          </div>
        )}

        {step === 5 && agentId && (
          <div className="grid md:grid-cols-2 gap-5">
            <div className="bg-surface border border-border rounded-card p-5">
              <h2 className="text-sm font-medium mb-3">Review</h2>
              <Row k="Agent" v={`${avatar} ${name}`} />
              <Row k="Tone" v={TONES.find((t) => t.value === tone)?.label ?? tone} />
              <Row
                k="Capabilities"
                v={
                  CAPABILITIES.filter((c) => capabilities.includes(c.key))
                    .map((c) => c.label)
                    .join(", ") || "None"
                }
              />
              <Row
                k="Channels"
                v={
                  CHANNELS.filter((c) => channels.includes(c.key))
                    .map((c) => c.label)
                    .join(", ") || "None"
                }
              />
              <Row
                k="Knowledge"
                v={`${docs.length} file(s), ${readable} readable by the agent`}
              />
              <p className="text-xs text-muted mt-4 mb-4">
                Try it on the right. After launch you can add rules and workflows from the
                agent&apos;s page.
              </p>
              <button
                onClick={launch}
                disabled={busy}
                className="w-full bg-brass text-ink font-medium text-sm rounded-md py-2.5 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {busy ? "Launching…" : "Launch agent"} {!busy && <Check size={15} />}
              </button>
              <button
                onClick={() => setStep(4)}
                className="w-full text-sm text-muted mt-2 flex items-center justify-center gap-1"
              >
                <ArrowLeft size={14} /> Back
              </button>
            </div>
            <AgentChat agentId={agentId} agentName={name} agentAvatar={avatar} />
          </div>
        )}
      </main>
    </div>
  );
}

function Choice({
  on,
  onClick,
  children
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`text-left text-sm px-3 py-3 rounded-md border ${
        on ? "border-brass bg-brass/10 text-brass font-medium" : "border-border text-muted"
      }`}
    >
      {children}
    </button>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm py-1.5 border-b border-border last:border-0">
      <span className="text-muted">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}

function NavButtons({
  onBack,
  onNext,
  busy,
  nextLabel = "Continue"
}: {
  onBack: () => void;
  onNext: () => void;
  busy?: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="flex gap-2 mt-5">
      <button
        onClick={onBack}
        className="flex-1 border border-border rounded-md py-2.5 text-sm flex items-center justify-center gap-1"
      >
        <ArrowLeft size={14} /> Back
      </button>
      <button
        onClick={onNext}
        disabled={busy}
        className="flex-1 bg-brass text-ink font-medium rounded-md py-2.5 text-sm flex items-center justify-center gap-1 disabled:opacity-60"
      >
        {busy ? "Saving…" : nextLabel} {!busy && <ArrowRight size={14} />}
      </button>
    </div>
  );
}
