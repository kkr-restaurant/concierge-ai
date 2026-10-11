"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const TABS = [
  { key: "overview", label: "Overview", path: "" },
  { key: "knowledge", label: "Knowledge", path: "/knowledge-base" },
  { key: "workflows", label: "Workflows", path: "/workflows" },
  { key: "rules", label: "Rules", path: "/rules" }
] as const;

export type AgentTabKey = (typeof TABS)[number]["key"];

export default function AgentTabs({
  agentId,
  active,
  agentName,
  agentAvatar,
  status
}: {
  agentId: string;
  active: AgentTabKey;
  agentName?: string;
  agentAvatar?: string;
  status?: "draft" | "live";
}) {
  return (
    <div className="mb-6">
      <Link
        href="/agents"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg mb-3"
      >
        <ArrowLeft size={12} /> All agents
      </Link>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{agentAvatar ?? "🤖"}</span>
        <h1 className="font-display text-xl font-medium">{agentName ?? "Agent"}</h1>
        {status && (
          <span
            className={`text-xs px-2 py-0.5 rounded-md border ${
              status === "live"
                ? "text-success border-success bg-success/10"
                : "text-muted border-border"
            }`}
          >
            {status === "live" ? "Live" : "Draft"}
          </span>
        )}
      </div>
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/agents/${agentId}${t.path}`}
            className={`px-3 py-2 text-sm -mb-px border-b-2 ${
              active === t.key
                ? "border-brass text-brass font-medium"
                : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
