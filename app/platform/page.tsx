"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ServerCog,
  Search,
  Plus,
  ScrollText,
  Eye,
  Ban,
  MoreVertical,
  AlertTriangle,
  CheckCircle2,
  X
} from "lucide-react";

type TenantStatus = "trial" | "active" | "at_risk" | "suspended" | "churned";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  plan: "starter" | "pro" | "enterprise";
  status: TenantStatus;
  ai_health_score: number;
  conversations_7d?: number;
  last_activity?: string | null;
};

type Incident = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  status: "open" | "acknowledged" | "resolved";
  affected_tenants: number;
};

type Kpis = {
  active_tenants: number;
  conversations_today: number;
  open_incidents: number;
  tenants_near_limit: number;
};

const REASON_OPTIONS = [
  { value: "non_payment", label: "Non-payment" },
  { value: "policy_violation", label: "Policy violation" },
  { value: "requested_by_hotel", label: "Requested by hotel" }
];

const IMPERSONATE_REASONS = [
  { value: "bug_reproduction", label: "Bug reproduction" },
  { value: "support_ticket", label: "Support ticket" },
  { value: "onboarding", label: "Onboarding assistance" }
];

function statusBadge(status: TenantStatus) {
  const map: Record<TenantStatus, string> = {
    active: "text-success bg-success/10 border-success/30",
    at_risk: "text-warning bg-warning/10 border-warning/30",
    trial: "text-steel bg-steel/10 border-steel/30",
    suspended: "text-danger bg-danger/10 border-danger/30",
    churned: "text-muted bg-muted/10 border-muted/30"
  };
  const label: Record<TenantStatus, string> = {
    active: "Active",
    at_risk: "At risk",
    trial: "Trial",
    suspended: "Suspended",
    churned: "Churned"
  };
  return { cls: `text-xs px-2 py-0.5 rounded-md border ${map[status]}`, label: label[status] };
}

function healthColor(score: number) {
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-danger";
}

export default function PlatformPortalPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [query, setQuery] = useState("");
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<Tenant | null>(null);
  const [suspendReason, setSuspendReason] = useState(REASON_OPTIONS[0].value);
  const [confirmName, setConfirmName] = useState("");
  const [suspending, setSuspending] = useState(false);
  const [impersonateTarget, setImpersonateTarget] = useState<Tenant | null>(null);
  const [impersonateReason, setImpersonateReason] = useState(IMPERSONATE_REASONS[0].value);
  const [impersonating, setImpersonating] = useState<{
    tenantName: string;
    sessionId: string;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [overviewRes, tenantsRes, incidentsRes] = await Promise.all([
      fetch("/api/v1/platform/overview"),
      fetch(`/api/v1/platform/tenants${query ? `?q=${encodeURIComponent(query)}` : ""}`),
      fetch("/api/v1/platform/incidents?status=open")
    ]);

    if (overviewRes.status === 401 || overviewRes.status === 403) {
      setAuthError(true);
      setLoading(false);
      router.replace("/platform/login");
      return;
    }

    if (overviewRes.ok) setKpis((await overviewRes.json()).kpis);
    if (tenantsRes.ok) setTenants((await tenantsRes.json()).tenants);
    if (incidentsRes.ok) setIncidents((await incidentsRes.json()).incidents);
    setLoading(false);
  }, [query, router]);

  useEffect(() => {
    const debounce = setTimeout(loadAll, query ? 300 : 0);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function confirmSuspend() {
    if (!suspendTarget) return;
    setSuspending(true);
    const res = await fetch(`/api/v1/platform/tenants/${suspendTarget.id}/suspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: suspendReason })
    });
    setSuspending(false);

    if (!res.ok) {
      showToast("Couldn't suspend tenant — try again or contact platform-eng.");
      return;
    }

    setTenants((ts) =>
      ts.map((t) => (t.id === suspendTarget.id ? { ...t, status: "suspended" } : t))
    );
    showToast(`${suspendTarget.name} suspended.`);
    setSuspendTarget(null);
    setConfirmName("");
  }

  async function confirmImpersonate() {
    if (!impersonateTarget) return;
    const res = await fetch(`/api/v1/platform/tenants/${impersonateTarget.id}/impersonate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason_code: impersonateReason })
    });

    if (!res.ok) {
      showToast("Couldn't start impersonation session.");
      return;
    }

    const data = await res.json();
    setImpersonating({ tenantName: impersonateTarget.name, sessionId: data.session_id });
    setImpersonateTarget(null);
    showToast(`Impersonation started for ${impersonateTarget.name}.`);
  }

  async function endImpersonation() {
    if (!impersonating) return;
    await fetch(`/api/v1/platform/impersonation/${impersonating.sessionId}/end`, {
      method: "POST"
    });
    setImpersonating(null);
    showToast("Impersonation session ended.");
  }

  async function acknowledgeIncident(id: string) {
    const res = await fetch(`/api/v1/platform/incidents/${id}/acknowledge`, { method: "POST" });
    if (!res.ok) {
      showToast("Couldn't acknowledge incident — try again.");
      return;
    }
    setIncidents((incs) => incs.filter((i) => i.id !== id));
    showToast("Incident acknowledged.");
  }

  if (authError) return null; // redirecting

  return (
    <main className="min-h-screen bg-pInk text-fg">
      {impersonating && (
        <div className="sticky top-0 z-50 bg-danger/15 border-b border-danger/40 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-danger">
            <Eye size={15} />
            Viewing as {impersonating.tenantName} — started by you
          </div>
          <button
            onClick={endImpersonation}
            className="text-xs border border-danger/40 text-danger rounded-md px-2.5 py-1 hover:bg-danger/10"
          >
            End session
          </button>
        </div>
      )}

      <div className="p-6 md:p-10 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-steel/15 border border-steel/40 flex items-center justify-center">
              <ServerCog size={15} className="text-steel" />
            </div>
            <span className="font-medium text-sm">Platform</span>
            <span className="text-xs text-muted border border-pBorder px-1.5 py-0.5 rounded ml-1">prod</span>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 text-sm border border-pBorder rounded-md px-3 py-2 hover:bg-pSurface2">
              <ScrollText size={15} /> Audit logs
            </button>
            <button className="flex items-center gap-2 text-sm bg-steel text-white rounded-md px-3 py-2 hover:brightness-110">
              <Plus size={15} /> Create tenant
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Kpi label="Active tenants" value={kpis ? String(kpis.active_tenants) : "—"} />
          <Kpi
            label="Conversations today"
            value={kpis ? kpis.conversations_today.toLocaleString() : "—"}
          />
          <Kpi
            label="Open incidents"
            value={String(incidents.length)}
            accent={incidents.length > 0 ? "danger" : undefined}
          />
          <Kpi label="Near plan limit" value={kpis ? String(kpis.tenants_near_limit) : "—"} />
        </div>

        <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
          <div>
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tenants"
                className="w-full bg-pSurface2 border border-pBorder rounded-md pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-steel/60"
              />
            </div>

            <div className="bg-pSurface border border-pBorder rounded-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-pBorder">
                    <th className="font-normal px-4 py-2.5">Hotel</th>
                    <th className="font-normal px-2 py-2.5">Plan</th>
                    <th className="font-normal px-2 py-2.5">Status</th>
                    <th className="font-normal px-2 py-2.5 text-right">Health</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted text-sm py-8">
                        Loading tenants…
                      </td>
                    </tr>
                  )}
                  {!loading && tenants.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted text-sm py-8">
                        No tenants match &apos;{query}&apos;.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    tenants.map((t) => {
                      const b = statusBadge(t.status);
                      return (
                        <tr
                          key={t.id}
                          className="border-b border-pBorder last:border-0 hover:bg-pSurface2 relative"
                        >
                          <td className="px-4 py-3">{t.name}</td>
                          <td className="px-2 py-3 text-muted capitalize">{t.plan}</td>
                          <td className="px-2 py-3">
                            <span className={b.cls}>{b.label}</span>
                          </td>
                          <td className={`px-2 py-3 text-right font-mono ${healthColor(t.ai_health_score)}`}>
                            {t.status === "suspended" ? "—" : t.ai_health_score}
                          </td>
                          <td className="px-2 py-3 text-right relative">
                            <button
                              onClick={() => setMenuOpenFor(menuOpenFor === t.id ? null : t.id)}
                              aria-label={`Actions for ${t.name}`}
                              className="text-muted hover:text-fg"
                            >
                              <MoreVertical size={16} />
                            </button>
                            {menuOpenFor === t.id && (
                              <div className="absolute right-2 top-9 z-10 bg-pSurface2 border border-pBorder rounded-md shadow-lg w-40 text-left">
                                <button
                                  onClick={() => {
                                    setImpersonateTarget(t);
                                    setMenuOpenFor(null);
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-pSurface"
                                >
                                  <Eye size={13} /> Impersonate
                                </button>
                                {t.status !== "suspended" && (
                                  <button
                                    onClick={() => {
                                      setSuspendTarget(t);
                                      setMenuOpenFor(null);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-danger hover:bg-danger/10"
                                  >
                                    <Ban size={13} /> Suspend
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-pSurface border border-pBorder rounded-card p-4">
            <p className="text-xs text-muted mb-3">Open incidents</p>
            {incidents.length === 0 && (
              <div className="text-center py-6">
                <CheckCircle2 size={20} className="text-success mx-auto mb-2" />
                <p className="text-xs text-muted">No open incidents.</p>
              </div>
            )}
            {incidents.map((i) => (
              <div key={i.id} className="flex items-start justify-between gap-2 py-2.5 border-b border-pBorder last:border-0">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className={i.severity === "critical" ? "text-danger mt-0.5" : "text-warning mt-0.5"} />
                  <div>
                    <p className="text-xs">{i.title}</p>
                    <p className="text-[11px] text-muted">
                      {i.affected_tenants} tenant{i.affected_tenants !== 1 ? "s" : ""} affected
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => acknowledgeIncident(i.id)}
                  className="text-[11px] text-muted hover:text-fg shrink-0"
                >
                  Ack
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {suspendTarget && (
        <Modal onClose={() => { setSuspendTarget(null); setConfirmName(""); }}>
          <h2 className="font-display text-lg font-medium mb-2">Suspend this tenant</h2>
          <p className="text-sm text-muted mb-4">
            This stops {suspendTarget.name}&apos;s guest-facing AI immediately. This can be reversed later.
          </p>
          <label className="text-xs text-muted mb-1 block">Reason</label>
          <select
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            className="w-full bg-pSurface2 border border-pBorder rounded-md px-3 py-2 text-sm mb-3"
          >
            {REASON_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <label className="text-xs text-muted mb-1 block">
            Type {suspendTarget.name} to confirm
          </label>
          <input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={suspendTarget.name}
            className="w-full bg-pSurface2 border border-pBorder rounded-md px-3 py-2 text-sm mb-4 outline-none focus:ring-2 focus:ring-danger/50"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setSuspendTarget(null); setConfirmName(""); }} className="text-sm border border-pBorder rounded-md px-3 py-2 hover:bg-pSurface2">
              Cancel
            </button>
            <button
              onClick={confirmSuspend}
              disabled={confirmName !== suspendTarget.name || suspending}
              className="text-sm bg-danger text-white rounded-md px-3 py-2 disabled:opacity-40 hover:brightness-110"
            >
              {suspending ? "Suspending…" : "Suspend tenant"}
            </button>
          </div>
        </Modal>
      )}

      {impersonateTarget && (
        <Modal onClose={() => setImpersonateTarget(null)}>
          <h2 className="font-display text-lg font-medium mb-2">Impersonate {impersonateTarget.name}</h2>
          <p className="text-sm text-muted mb-4">
            You&apos;ll view this hotel&apos;s admin dashboard for up to 1 hour. This is logged and visible to the hotel&apos;s own admins.
          </p>
          <label className="text-xs text-muted mb-1 block">Reason</label>
          <select
            value={impersonateReason}
            onChange={(e) => setImpersonateReason(e.target.value)}
            className="w-full bg-pSurface2 border border-pBorder rounded-md px-3 py-2 text-sm mb-6"
          >
            {IMPERSONATE_REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <button onClick={() => setImpersonateTarget(null)} className="text-sm border border-pBorder rounded-md px-3 py-2 hover:bg-pSurface2">
              Cancel
            </button>
            <button onClick={confirmImpersonate} className="text-sm bg-steel text-white rounded-md px-3 py-2 hover:brightness-110">
              Start session
            </button>
          </div>
        </Modal>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-pSurface2 border border-pBorder rounded-md px-4 py-2.5 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "danger" }) {
  return (
    <div className="bg-pSurface border border-pBorder rounded-card px-4 py-3">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className={`text-xl font-medium font-display ${accent === "danger" ? "text-danger" : ""}`}>{value}</p>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-pSurface border border-pBorder rounded-card p-6 max-w-sm w-full relative">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-muted hover:text-fg">
          <X size={16} />
        </button>
        {children}
      </div>
    </div>
  );
}
