"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", built: true },
  { href: "/ai-assistant", label: "AI Assistant", built: true },
  // Workflows and Workflow Designer share a destination (you pick a
  // workflow from the list, then open its designer) — isActive distinguishes
  // them by whether the current path is the list itself or a sub-route, so
  // only one highlights at a time instead of both lighting up together.
  { href: "/workflows", label: "Workflows", built: true, isActive: (c: string) => c === "/workflows" },
  {
    href: "/workflows",
    label: "Workflow Designer",
    built: true,
    isActive: (c: string) => c.startsWith("/workflows/")
  },
  { href: "/rules", label: "Rules", built: true },
  { href: "/knowledge-base", label: "Knowledge Base", built: true },
  { href: "/integrations", label: "Integrations", built: true },
  { href: "#", label: "Channels", built: false },
  { href: "#", label: "Analytics", built: false },
  { href: "/users", label: "Users", built: true },
  { href: "/settings", label: "Settings", built: true }
];

export default function BusinessSidebar({
  current,
  businessName
}: {
  current: string;
  businessName?: string;
}) {
  return (
    <nav className="w-[200px] flex-shrink-0 bg-surface border-r border-border p-3 min-h-screen">
      <div className="flex items-center gap-2 px-2 pb-4 mb-2 border-b border-border">
        <div className="w-7 h-7 rounded-md bg-brass flex items-center justify-center flex-shrink-0">
          <Building2 size={14} className="text-ink" />
        </div>
        <span className="font-display font-medium text-sm truncate">
          {businessName ?? "ConciergeAI"}
        </span>
      </div>
      {NAV.map((item) => {
        const isActive = item.isActive ? item.isActive(current) : item.href === current;
        if (!item.built) {
          return (
            <div
              key={item.label}
              className="px-3 py-2 text-sm text-muted/40 cursor-default select-none"
            >
              {item.label}
            </div>
          );
        }
        return (
          <Link
            key={item.label}
            href={item.href}
            className={`block px-3 py-2 rounded-md text-sm mb-0.5 ${
              isActive ? "bg-brass/15 text-brass font-medium" : "text-muted hover:bg-surface2"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
