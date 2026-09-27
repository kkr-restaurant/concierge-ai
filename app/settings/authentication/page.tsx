"use client";

import { useState } from "react";
import {
  LogOut,
  UserPlus,
  Laptop,
  Smartphone,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Clock
} from "lucide-react";

type Tab = "general" | "sso" | "sessions" | "activity";

const TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "sso", label: "Single sign-on" },
  { id: "sessions", label: "Sessions" },
  { id: "activity", label: "Login activity" }
];

const SESSIONS = [
  { id: "sess_4471", user: "Fatima Al-Zahrani", device: "Chrome on macOS", type: "desktop", location: "Riyadh, SA", lastActive: "2m ago" },
  { id: "sess_4472", user: "Layla Ibrahim", device: "Safari on iPhone", type: "mobile", location: "Riyadh, SA", lastActive: "31m ago" },
  { id: "sess_4473", user: "Omar Haddad", device: "Chrome on Windows", type: "desktop", location: "Jeddah, SA", lastActive: "3h ago" }
];

const ACTIVITY = [
  { time: "07:12:00", user: "Fatima Al-Zahrani", result: "success", ip: "212.34.11.9", device: "Chrome / macOS" },
  { time: "06:50:00", user: "Omar Haddad", result: "locked", ip: "212.34.11.55", device: "Chrome / Windows" },
  { time: "06:46:00", user: "Omar Haddad", result: "failed", ip: "212.34.11.55", device: "Chrome / Windows" },
  { time: "06:45:00", user: "Omar Haddad", result: "failed", ip: "212.34.11.55", device: "Chrome / Windows" }
];

function resultBadge(result: string) {
  const map: Record<string, string> = {
    success: "text-success bg-success/10 border-success/30",
    failed: "text-danger bg-danger/10 border-danger/30",
    locked: "text-warning bg-warning/10 border-warning/30"
  };
  return `text-xs px-2 py-0.5 rounded-md border ${map[result]}`;
}

export default function AuthSettingsPage() {
  const [tab, setTab] = useState<Tab>("general");
  const [requireMfa, setRequireMfa] = useState(true);
  const [sessions, setSessions] = useState(SESSIONS);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function revokeSession(id: string) {
    const target = sessions.find((s) => s.id === id);
    setSessions((s) => s.filter((sess) => sess.id !== id));
    setConfirmRevoke(null);
    if (target) showToast(`Session ended for ${target.user}.`);
  }

  return (
    <main className="min-h-screen bg-ink p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-muted font-mono mb-1">Settings / Authentication</p>
            <h1 className="font-display text-2xl font-medium">Authentication and security</h1>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 text-sm border border-border rounded-md px-3 py-2 hover:bg-surface2">
              <UserPlus size={15} /> Invite user
            </button>
            <button className="flex items-center gap-2 text-sm border border-border rounded-md px-3 py-2 hover:bg-danger/10 hover:border-danger/40 hover:text-danger">
              <LogOut size={15} /> Force logout all
            </button>
          </div>
        </div>

        <div className="flex gap-6 border-b border-border mb-6 text-sm">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`pb-3 -mb-px border-b-2 ${
                tab === t.id ? "border-brass text-fg" : "border-transparent text-muted hover:text-fg"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
          <div className="flex flex-col gap-4">
            {tab === "general" && (
              <>
                <Card title="Password policy" icon={<Lock size={16} className="text-brass" />}>
                  <Row label="Minimum length" value="12 characters" />
                  <Row label="Require number and symbol" value="Enabled" />
                  <Row label="Expiry" value="90 days" />
                </Card>

                <Card title="Multi-factor authentication" icon={<ShieldCheck size={16} className="text-brass" />}>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm">Require for all users</span>
                    <button
                      role="switch"
                      aria-checked={requireMfa}
                      onClick={() => {
                        setRequireMfa((v) => !v);
                        showToast(!requireMfa ? "MFA now required for all users." : "MFA requirement removed.");
                      }}
                      className={`w-10 h-6 rounded-full relative transition-colors ${
                        requireMfa ? "bg-brass" : "bg-surface2 border border-border"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-ink transition-transform ${
                          requireMfa ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                  <Row label="Methods" value="Authenticator app, Email" />
                </Card>

                <Card title="Session policy" icon={<Clock size={16} className="text-brass" />}>
                  <Row label="Idle timeout" value="30 minutes" />
                  <Row label="Concurrent sessions" value="1 per user" />
                </Card>
              </>
            )}

            {tab === "sso" && (
              <Card title="Identity providers">
                {["Okta", "Azure AD", "Google Workspace"].map((p, i) => (
                  <div key={p} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <span className="text-sm">{p}</span>
                    {i === 0 ? (
                      <span className="text-xs px-2 py-0.5 rounded-md border text-success bg-success/10 border-success/30">Active</span>
                    ) : (
                      <button className="text-xs border border-border rounded-md px-2.5 py-1 hover:bg-surface2">Connect</button>
                    )}
                  </div>
                ))}
              </Card>
            )}

            {tab === "sessions" && (
              <Card title={`Active sessions (${sessions.length})`}>
                {sessions.length === 0 && (
                  <p className="text-sm text-muted py-6 text-center">No active sessions.</p>
                )}
                {sessions.map((s) => (
                  <div key={s.id} className="ledger-row flex items-center justify-between py-3 border-b border-border last:border-0 -mx-2 px-2 rounded-md">
                    <div className="flex items-center gap-3">
                      {s.type === "desktop" ? <Laptop size={16} className="text-muted" /> : <Smartphone size={16} className="text-muted" />}
                      <div>
                        <p className="text-sm">{s.user}</p>
                        <p className="text-xs text-muted font-mono">{s.device} · {s.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted">{s.lastActive}</span>
                      <button
                        onClick={() => setConfirmRevoke(s.id)}
                        className="text-xs text-danger border border-danger/30 rounded-md px-2.5 py-1 hover:bg-danger/10"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {tab === "activity" && (
              <Card title="Login activity">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted border-b border-border">
                        <th className="pb-2 font-normal">Time</th>
                        <th className="pb-2 font-normal">User</th>
                        <th className="pb-2 font-normal">Result</th>
                        <th className="pb-2 font-normal">IP</th>
                        <th className="pb-2 font-normal">Device</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono text-xs">
                      {ACTIVITY.map((a, i) => (
                        <tr key={i} className="ledger-row border-b border-border last:border-0">
                          <td className="py-2.5">{a.time}</td>
                          <td className="py-2.5 font-sans">{a.user}</td>
                          <td className="py-2.5">
                            <span className={resultBadge(a.result)}>{a.result}</span>
                          </td>
                          <td className="py-2.5">{a.ip}</td>
                          <td className="py-2.5">{a.device}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <Card title="Security score">
              <p className="font-display text-3xl font-medium mb-1">
                78<span className="text-sm text-muted font-sans">/100</span>
              </p>
              <div className="w-full h-1.5 bg-surface2 rounded-full mb-4">
                <div className="h-full bg-brass rounded-full" style={{ width: "78%" }} />
              </div>
              <div className="flex gap-2 text-xs text-muted mb-2">
                <ShieldAlert size={14} className="text-warning shrink-0 mt-0.5" />
                <span>2 of 3 users don&apos;t have MFA enabled.</span>
              </div>
              <div className="flex gap-2 text-xs text-muted">
                <ShieldAlert size={14} className="text-warning shrink-0 mt-0.5" />
                <span>1 session idle for over 12 hours.</span>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {confirmRevoke && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-border rounded-card p-6 max-w-sm w-full">
            <h2 className="font-display text-lg font-medium mb-2">End this session?</h2>
            <p className="text-sm text-muted mb-6">
              {sessions.find((s) => s.id === confirmRevoke)?.user} will be signed out immediately on that device.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmRevoke(null)}
                className="text-sm border border-border rounded-md px-3 py-2 hover:bg-surface2"
              >
                Cancel
              </button>
              <button
                onClick={() => revokeSession(confirmRevoke)}
                className="text-sm bg-danger text-white rounded-md px-3 py-2 hover:brightness-110"
              >
                End session
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-surface border border-border rounded-md px-4 py-2.5 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-card p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <p className="text-sm font-medium">{title}</p>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
