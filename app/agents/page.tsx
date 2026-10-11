"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import BusinessSidebar from "@/app/_components/BusinessSidebar";
import { CAPABILITIES, CHANNELS } from "@/lib/agent-options";

type Agent = {
  id: string;
  name: string;
  avatar: string;
  description: string;
  status: "draft" | "live";
  capabilities: string[];
  channels: string[];
};

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/v1/tenants/agents");
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
      setAgents(data.agents);
      setRole(data.role);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const canCreate = role === "owner" || role === "admin";

  return (
    <div className="flex min-h-screen bg-ink text-fg">
      <BusinessSidebar current="/agents" />
      <main className="flex-1 p-8 max-w-4xl">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="font-display text-xl font-medium">Agents</h1>
            <p className="text-muted text-sm">
              Each agent has its own knowledge, rules, workflows, capabilities, and channels
            </p>
          </div>
          {canCreate && (
            <Link
              href="/agents/new"
              className="flex items-center gap-2 text-sm bg-brass text-ink font-medium rounded-md px-3 py-2"
            >
              <Plus size={15} /> Create agent
            </Link>
          )}
        </div>
        <p className="text-xs text-muted mb-6">
          Agents can hold real conversations, using their own rules and any .txt/.md/.csv knowledge
          files you upload. They can&apos;t take real actions (orders, bookings, tickets), and
          channels are recorded but not actually connected yet.
        </p>

        {loading ? (
          <p className="text-muted text-sm">Loading…</p>
        ) : agents.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-card">
            <p className="text-muted text-sm mb-3">No agents yet.</p>
            {canCreate && (
              <Link href="/agents/new" className="text-brass text-sm">
                Create your first agent →
              </Link>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {agents.map((a) => (
              <Link
                key={a.id}
                href={`/agents/${a.id}`}
                className="bg-surface border border-border rounded-card p-5 hover:border-brass transition-colors block"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{a.avatar}</span>
                    <span className="font-medium">{a.name}</span>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-md border ${
                      a.status === "live"
                        ? "text-success border-success bg-success/10"
                        : "text-muted border-border"
                    }`}
                  >
                    {a.status === "live" ? "Live" : "Draft"}
                  </span>
                </div>
                {a.description && (
                  <p className="text-xs text-muted mb-3 line-clamp-2">{a.description}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {CAPABILITIES.filter((c) => a.capabilities.includes(c.key)).map((c) => (
                    <span
                      key={c.key}
                      className="text-[11px] px-1.5 py-0.5 rounded bg-surface2 text-muted"
                    >
                      {c.icon} {c.label}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CHANNELS.filter((c) => a.channels.includes(c.key)).map((c) => (
                    <span
                      key={c.key}
                      className="text-[11px] px-1.5 py-0.5 rounded border border-border text-muted"
                    >
                      {c.icon} {c.label}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
