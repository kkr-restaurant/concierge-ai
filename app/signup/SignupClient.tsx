"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

const TOTAL_STEPS = 7;

const BUSINESS_TYPES = [
  { value: "hotel", label: "Hotel", icon: "🏨" },
  { value: "restaurant", label: "Restaurant", icon: "🍽️" },
  { value: "medical_clinic", label: "Medical Clinic", icon: "🩺" },
  { value: "school", label: "School", icon: "🎓" },
  { value: "retail", label: "Retail", icon: "🛍️" },
  { value: "other", label: "Other", icon: "✳️" }
] as const;

type BusinessType = (typeof BUSINESS_TYPES)[number]["value"];

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function SignupPage({
  supabaseUrl,
  supabaseAnonKey
}: {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  // True for someone who already has an account (confirmed their email
  // separately, or signed in directly) but hasn't finished the rest of the
  // wizard yet — skips the "create account" step entirely rather than
  // calling signUp() again, which would silently no-op for an existing
  // address and strand them with no way back in.
  const [resumingSession, setResumingSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Step 1
  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 2
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);

  // Step 3 (cosmetic only — no channels table yet)
  const [channels, setChannels] = useState<string[]>([]);

  // Step 4 (cosmetic only — no documents table yet)
  const [sampleFiles, setSampleFiles] = useState<string[]>([]);

  // Step 6
  const [plan, setPlan] = useState<"starter" | "pro" | "enterprise">("starter");

  const supabase =
    supabaseUrl && supabaseAnonKey ? createBrowserSupabaseClient(supabaseUrl, supabaseAnonKey) : null;

  useEffect(() => {
    if (!supabase) {
      setCheckingSession(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setResumingSession(true);
        setEmail(session.user.email ?? "");
        setStep(2);
      }
      setCheckingSession(false);
    });
    // Only on mount — this is a one-time check, not a live subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleStep1Continue() {
    if (!supabase) return;
    setError(null);
    if (!businessName.trim() || !slug.trim() || !email.trim() || !password) {
      setError("Fill in every field to continue.");
      return;
    }
    setSubmitting(true);
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    setSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (!data.session) {
      // Project has "Confirm email" turned on — signUp succeeded but there's
      // no active session yet. Can't continue the wizard without one (the
      // rest of the flow needs an authenticated user), so stop here with a
      // clear message rather than pretending to continue.
      setNeedsEmailConfirm(true);
      return;
    }

    setStep(2);
  }

  async function handleFinish() {
    if (!businessType) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/v1/tenants/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: businessName, slug, business_type: businessType, plan })
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      if (res.status === 409 && body?.error === "slug_taken") {
        setError("That business URL is already taken — go back and change it.");
      } else if (res.status === 409 && body?.error === "already_registered") {
        setError("This account already has a business registered.");
      } else {
        setError("Something went wrong creating your account — try again.");
      }
      return;
    }

    setStep(7);
  }

  if (!supabase) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="font-display text-lg font-medium text-danger mb-2">
            Sign-up is temporarily unavailable
          </h1>
          <p className="text-sm text-muted">Missing server configuration. Please try again later.</p>
        </div>
      </main>
    );
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-ink">
        <p className="text-muted text-sm">Loading…</p>
      </main>
    );
  }

  if (needsEmailConfirm) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-ink text-fg">
        <div className="max-w-sm text-center bg-surface border border-border rounded-card p-8">
          <div className="w-12 h-12 rounded-full bg-brass/15 flex items-center justify-center mx-auto mb-4">
            <Mail size={22} className="text-brass" />
          </div>
          <h1 className="font-display text-lg font-medium mb-2">Check your email</h1>
          <p className="text-sm text-muted">
            We sent a confirmation link to <span className="text-fg">{email}</span>. Click it, then
            come back and sign in to finish setting up {businessName || "your business"}.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ink text-fg">
      <div className="max-w-xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-7 h-7 rounded-md bg-brass flex items-center justify-center">
            <Building2 size={15} className="text-ink" />
          </div>
          <span className="font-display font-medium">ConciergeAI</span>
        </div>

        <div className="flex gap-1.5 mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i < step ? "bg-brass" : "bg-border"}`}
            />
          ))}
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 text-sm text-danger bg-danger/10 border border-danger/30 rounded-md px-3 py-2"
          >
            {error}
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 className="font-display text-xl font-medium mb-1">Create your account</h1>
            <p className="text-muted text-sm mb-6">Takes about a minute.</p>

            <label className="text-xs text-muted mb-1 block">Business name</label>
            <input
              value={businessName}
              onChange={(e) => {
                setBusinessName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              placeholder="Sunset Grill"
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm mb-4 outline-none focus:ring-2 focus:ring-brass/60"
            />

            <label className="text-xs text-muted mb-1 block">Business URL</label>
            <input
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase());
              }}
              placeholder="sunset-grill"
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm mb-4 font-mono outline-none focus:ring-2 focus:ring-brass/60"
            />

            <label className="text-xs text-muted mb-1 block">Email</label>
            <div className="relative mb-4">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourbusiness.com"
                className="w-full bg-surface2 border border-border rounded-md pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brass/60"
              />
            </div>

            <label className="text-xs text-muted mb-1 block">Password</label>
            <div className="relative mb-6">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full bg-surface2 border border-border rounded-md pl-9 pr-9 py-2 text-sm outline-none focus:ring-2 focus:ring-brass/60"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <button
              onClick={handleStep1Continue}
              disabled={submitting}
              className="w-full bg-brass text-ink font-medium text-sm rounded-md py-2.5 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting ? "Creating account…" : "Continue"} {!submitting && <ArrowRight size={16} />}
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="font-display text-xl font-medium mb-1">
              {resumingSession ? "Let's finish setting up" : "What kind of business is this?"}
            </h1>
            <p className="text-muted text-sm mb-6">
              {resumingSession
                ? "Your account is confirmed — just a few more details."
                : "Sets a starter knowledge template and default rules."}
            </p>

            {resumingSession && (
              <>
                <label className="text-xs text-muted mb-1 block">Business name</label>
                <input
                  value={businessName}
                  onChange={(e) => {
                    setBusinessName(e.target.value);
                    if (!slugTouched) setSlug(slugify(e.target.value));
                  }}
                  placeholder="Sunset Grill"
                  className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm mb-4 outline-none focus:ring-2 focus:ring-brass/60"
                />
                <label className="text-xs text-muted mb-1 block">Business URL</label>
                <input
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value.toLowerCase());
                  }}
                  placeholder="sunset-grill"
                  className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm mb-6 font-mono outline-none focus:ring-2 focus:ring-brass/60"
                />
              </>
            )}

            <div className="grid grid-cols-3 gap-2 mb-6">
              {BUSINESS_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setBusinessType(t.value)}
                  className={`border rounded-md py-4 text-sm text-center ${
                    businessType === t.value
                      ? "border-brass bg-brass/10 text-brass font-medium"
                      : "border-border text-muted"
                  }`}
                >
                  <div className="text-xl mb-1">{t.icon}</div>
                  {t.label}
                </button>
              ))}
            </div>
            <StepNav
              onBack={() => (resumingSession ? router.push("/dashboard") : setStep(1))}
              onNext={() => setStep(3)}
              nextDisabled={
                !businessType || (resumingSession && (!businessName.trim() || !slug.trim()))
              }
            />
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="font-display text-xl font-medium mb-1">Where should it talk to customers?</h1>
            <p className="text-muted text-sm mb-6">
              Pick as many as you like — you can change this anytime once you&apos;re in.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {["WhatsApp", "Web widget"].map((c) => (
                <button
                  key={c}
                  onClick={() =>
                    setChannels((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))
                  }
                  className={`border rounded-md py-4 text-sm text-center ${
                    channels.includes(c)
                      ? "border-brass bg-brass/10 text-brass font-medium"
                      : "border-border text-muted"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <StepNav onBack={() => setStep(2)} onNext={() => setStep(4)} />
          </div>
        )}

        {step === 4 && (
          <div>
            <h1 className="font-display text-xl font-medium mb-1">Feed it some knowledge</h1>
            <p className="text-muted text-sm mb-6">
              Upload menus, policies, FAQs — or skip and do this later from your dashboard.
            </p>
            <div className="border-2 border-dashed border-border rounded-md p-8 text-center text-muted text-sm mb-3">
              Drag &amp; drop files here, or click to browse
            </div>
            {sampleFiles.map((f) => (
              <div key={f} className="flex justify-between text-sm py-2 border-b border-border">
                <span>{f}</span>
                <span className="text-success">Uploaded</span>
              </div>
            ))}
            <button
              onClick={() => setSampleFiles((cur) => [...cur, `Document-${cur.length + 1}.pdf`])}
              className="w-full border border-border rounded-md py-2 text-sm text-muted mb-6"
            >
              + Add a sample file
            </button>
            <StepNav onBack={() => setStep(3)} onNext={() => setStep(5)} />
          </div>
        )}

        {step === 5 && (
          <div>
            <h1 className="font-display text-xl font-medium mb-1">Connect your internal systems</h1>
            <p className="text-muted text-sm mb-6">
              Optional — link a CRM, PMS, EHR, or POS so the assistant can see live data.
            </p>
            <div className="flex justify-between items-center border border-border rounded-md px-4 py-3 mb-2 text-sm">
              <span>Booking / PMS system</span>
              <button className="text-xs border border-border rounded-md px-3 py-1">Connect</button>
            </div>
            <div className="flex justify-between items-center border border-border rounded-md px-4 py-3 mb-6 text-sm">
              <span>Custom webhook</span>
              <button className="text-xs border border-border rounded-md px-3 py-1">Connect</button>
            </div>
            <StepNav onBack={() => setStep(4)} onNext={() => setStep(6)} />
          </div>
        )}

        {step === 6 && (
          <div>
            <h1 className="font-display text-xl font-medium mb-1">Choose your plan</h1>
            <div className="bg-brass/10 text-brass text-sm rounded-md px-3 py-2 mb-4 text-center">
              15-day free trial included on any plan — no charge until it ends
            </div>
            <div className="grid grid-cols-3 gap-2 mb-6">
              {(["starter", "pro", "enterprise"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlan(p)}
                  className={`border rounded-md py-4 text-center capitalize ${
                    plan === p ? "border-brass bg-brass/10 text-brass font-medium" : "border-border text-muted"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              onClick={handleFinish}
              disabled={submitting}
              className="w-full bg-brass text-ink font-medium text-sm rounded-md py-2.5 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting ? "Setting up…" : "Finish"} {!submitting && <ArrowRight size={16} />}
            </button>
            <button
              onClick={() => setStep(5)}
              className="w-full text-sm text-muted mt-2 flex items-center justify-center gap-1"
            >
              <ArrowLeft size={14} /> Back
            </button>
          </div>
        )}

        {step === 7 && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={24} className="text-success" />
            </div>
            <h1 className="font-display text-xl font-medium mb-1">You&apos;re live</h1>
            <p className="text-muted text-sm mb-6">{businessName} is ready to go.</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="inline-flex items-center gap-2 text-sm text-brass"
            >
              Go to your dashboard <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function StepNav({
  onBack,
  onNext,
  nextDisabled
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onBack}
        className="flex-1 border border-border rounded-md py-2.5 text-sm flex items-center justify-center gap-1"
      >
        <ArrowLeft size={14} /> Back
      </button>
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="flex-1 bg-brass text-ink font-medium rounded-md py-2.5 text-sm flex items-center justify-center gap-1 disabled:opacity-40"
      >
        Continue <ArrowRight size={14} />
      </button>
    </div>
  );
}
