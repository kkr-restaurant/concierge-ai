"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2 } from "lucide-react";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  business_type: string;
  plan: string;
  status: string;
  created_at: string;
};

/**
 * This is NOT the full Business Console from the design mockups (Workflows,
 * Knowledge Base, Channels, etc. aren't built). It exists to prove the
 * signup -> tenant -> membership chain actually works end to end by showing
 * real data fetched from the database, not a hardcoded confirmation screen.
 */
export default function DashboardPage() {
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch("/api/v1/tenants/me")
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/login");
          return null;
        }
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setTenant(data.tenant);
          setRole(data.role);
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-ink text-fg">
        <p className="text-muted text-sm">Loading…</p>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-ink text-fg p-6">
        <div className="max-w-sm text-center">
          <p className="text-muted text-sm">
            This account isn&apos;t linked to a business yet.{" "}
            <a href="/signup" className="text-brass">
              Finish signing up
            </a>
            .
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ink text-fg p-6">
      <div className="max-w-lg mx-auto pt-10">
        <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={24} className="text-success" />
        </div>
        <div className="text-center mb-8">
          <h1 className="font-display text-xl font-medium mb-1">Welcome, {tenant?.name}</h1>
          <p className="text-muted text-sm">
            You&apos;re signed in as {role} — this data came from the database, not a mock.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={16} className="text-brass" />
            <span className="font-medium text-sm">Your business</span>
          </div>
          <Row label="Name" value={tenant?.name} />
          <Row label="URL" value={tenant?.slug} mono />
          <Row label="Business type" value={tenant?.business_type} />
          <Row label="Plan" value={tenant?.plan} />
          <Row label="Status" value={tenant?.status} />
          <Row
            label="Created"
            value={tenant?.created_at ? new Date(tenant.created_at).toLocaleString() : "—"}
          />
        </div>

        <p className="text-xs text-muted text-center mt-6">
          The full dashboard (Workflows, Knowledge Base, Channels, Analytics) isn&apos;t built yet —
          this screen exists to prove signup actually works end to end.
        </p>
      </div>
    </main>
  );
}

function Row({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="flex justify-between py-2 border-b border-border last:border-0 text-sm">
      <span className="text-muted">{label}</span>
      <span className={mono ? "font-mono" : ""}>{value ?? "—"}</span>
    </div>
  );
}
