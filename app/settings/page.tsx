"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import BusinessSidebar from "@/app/_components/BusinessSidebar";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  business_type: string;
  plan: string;
  status: string;
};

const BUSINESS_TYPES = ["hotel", "restaurant", "medical_clinic", "school", "retail", "other"];

export default function SettingsPage() {
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("other");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
      setName(data.tenant.name);
      setBusinessType(data.tenant.business_type);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const canEdit = role === "owner" || role === "admin";
  const canDelete = role === "owner";

  async function saveSettings() {
    setSaveError(null);
    setSaving(true);
    const res = await fetch("/api/v1/tenants/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, business_type: businessType })
    });
    setSaving(false);

    if (!res.ok) {
      setSaveError("Couldn't save changes — try again.");
      return;
    }
    const data = await res.json();
    setTenant(data.tenant);
    showToast("Settings saved.");
  }

  async function confirmDelete() {
    if (!tenant || confirmName !== tenant.name) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch("/api/v1/tenants/me", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm_name: confirmName })
    });
    setDeleting(false);

    if (!res.ok) {
      setDeleteError("Couldn't delete — try again.");
      return;
    }
    router.push("/login");
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
      <BusinessSidebar current="/settings" businessName={tenant?.name} />
      <main className="flex-1 p-8 max-w-xl">
        <h1 className="font-display text-xl font-medium mb-1">Settings</h1>
        <p className="text-muted text-sm mb-6">Business profile and account controls</p>

        <div className="bg-surface border border-border rounded-card p-5 mb-6">
          <h2 className="text-sm font-medium mb-4">Business profile</h2>

          {saveError && (
            <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-md px-3 py-2 mb-3">
              {saveError}
            </div>
          )}

          <label className="text-xs text-muted mb-1 block">Business name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit}
            className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm mb-4 disabled:opacity-60"
          />

          <label className="text-xs text-muted mb-1 block">Business type</label>
          <select
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            disabled={!canEdit}
            className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm mb-4 disabled:opacity-60 capitalize"
          >
            {BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>

          <label className="text-xs text-muted mb-1 block">Business URL</label>
          <input
            value={tenant?.slug ?? ""}
            disabled
            className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm mb-4 opacity-60"
          />
          <p className="text-[11px] text-muted mb-4">
            Not editable here — contact support if you need this changed.
          </p>

          <div className="flex justify-between text-sm py-2 border-t border-border mb-4">
            <span className="text-muted">Plan</span>
            <span className="capitalize">{tenant?.plan}</span>
          </div>
          <div className="flex justify-between text-sm py-2 border-t border-border mb-4">
            <span className="text-muted">Status</span>
            <span className="capitalize">{tenant?.status}</span>
          </div>

          {canEdit && (
            <button
              onClick={saveSettings}
              disabled={saving}
              className="w-full bg-brass text-ink font-medium text-sm rounded-md py-2.5 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          )}
        </div>

        {canDelete && (
          <div className="border border-danger/40 rounded-card p-5">
            <h2 className="text-sm font-medium text-danger mb-2">Danger zone</h2>
            <p className="text-xs text-muted mb-4">
              This permanently deletes {tenant?.name} and removes every team member&apos;s access.
              This can&apos;t be undone.
            </p>

            {deleteError && (
              <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-md px-3 py-2 mb-3">
                {deleteError}
              </div>
            )}

            <label className="text-xs text-muted mb-1 block">
              Type <span className="text-fg">{tenant?.name}</span> to confirm
            </label>
            <input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              className="w-full bg-surface2 border border-danger/30 rounded-md px-3 py-2 text-sm mb-3"
            />
            <button
              onClick={confirmDelete}
              disabled={confirmName !== tenant?.name || deleting}
              className="w-full bg-danger text-white font-medium text-sm rounded-md py-2.5 disabled:opacity-40"
            >
              {deleting ? "Deleting…" : "Delete business"}
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
