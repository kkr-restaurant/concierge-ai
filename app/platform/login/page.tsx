"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ServerCog, Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight, AlertTriangle } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type Step = "credentials" | "mfa" | "success";

export default function PlatformLoginPage() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfaDigits, setMfaDigits] = useState(["", "", "", "", "", ""]);
  const mfaRefs = useRef<Array<HTMLInputElement | null>>([]);

  // MFA challenge context, populated once credentials succeed.
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);

  async function handleCredentialSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }

    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      setSubmitting(false);
      setError("Invalid email or password.");
      return;
    }

    // MFA is mandatory for every platform account (no opt-out, unlike the
    // hotel side) — enforce that here rather than trusting the client to
    // ask for a factor.
    const { data: factorsData, error: factorsError } =
      await supabase.auth.mfa.listFactors();

    const totpFactor = factorsData?.totp?.[0];
    if (factorsError || !totpFactor) {
      setSubmitting(false);
      setError(
        "This account has no MFA factor enrolled. Platform accounts require MFA — contact platform-eng."
      );
      await supabase.auth.signOut();
      return;
    }

    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: totpFactor.id });

    setSubmitting(false);
    if (challengeError || !challenge) {
      setError("Couldn't start MFA verification — try again.");
      return;
    }

    setFactorId(totpFactor.id);
    setChallengeId(challenge.id);
    setStep("mfa");
  }

  function handleMfaChange(index: number, value: string) {
    if (!/^[0-9]?$/.test(value)) return;
    const next = [...mfaDigits];
    next[index] = value;
    setMfaDigits(next);
    setError(null);
    if (value && index < 5) mfaRefs.current[index + 1]?.focus();
    if (next.every((d) => d !== "")) verifyMfa(next.join(""));
  }

  function handleMfaKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !mfaDigits[index] && index > 0) {
      mfaRefs.current[index - 1]?.focus();
    }
  }

  async function verifyMfa(code: string) {
    if (!factorId || !challengeId) return;
    setSubmitting(true);

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code
    });

    if (verifyError) {
      setSubmitting(false);
      setError("Incorrect code — try again.");
      setMfaDigits(["", "", "", "", "", ""]);
      mfaRefs.current[0]?.focus();
      return;
    }

    // MFA succeeded and the session is now aal2 — but that only proves
    // "a valid Supabase user," not "a platform user." Confirm the
    // population claim server-side before treating this as a platform
    // session; this is what actually enforces population separation, not
    // just the UI flow.
    const sessionRes = await fetch("/api/v1/platform/session");
    setSubmitting(false);

    if (!sessionRes.ok) {
      setError("This account isn't provisioned for platform access.");
      await supabase.auth.signOut();
      setStep("credentials");
      return;
    }

    setStep("success");
  }

  return (
    <main className="min-h-screen bg-pInk flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-2">
          <div className="w-8 h-8 rounded-md bg-steel/15 border border-steel/40 flex items-center justify-center">
            <ServerCog size={17} className="text-steel" />
          </div>
          <span className="font-display font-medium text-fg">Platform admin</span>
        </div>
        <p className="text-xs text-muted text-center mb-6 font-mono">admin.hotelaiplatform.internal</p>

        <div className="bg-pSurface border border-pBorder rounded-card p-8">
          {step === "credentials" && (
            <form onSubmit={handleCredentialSubmit} noValidate>
              <div className="flex items-start gap-2 bg-steelSoft border border-steel/30 rounded-md px-3 py-2 mb-6">
                <AlertTriangle size={14} className="text-steel mt-0.5 shrink-0" />
                <p className="text-xs text-muted">
                  This portal is for platform operations staff only. Hotel staff should sign in at their own hotel&apos;s login page.
                </p>
              </div>

              {error && (
                <div role="alert" aria-live="assertive" className="mb-4 text-sm text-danger bg-danger/10 border border-danger/30 rounded-md px-3 py-2">
                  {error}
                </div>
              )}

              <label htmlFor="p-email" className="text-xs text-muted mb-1 block">Email</label>
              <div className="relative mb-4">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  id="p-email"
                  type="email"
                  autoComplete="username"
                  placeholder="you@hotelaiplatform.internal"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-pSurface2 border border-pBorder rounded-md pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-steel/60"
                />
              </div>

              <label htmlFor="p-password" className="text-xs text-muted mb-1 block">Password</label>
              <div className="relative mb-6">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  id="p-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-pSurface2 border border-pBorder rounded-md pl-9 pr-9 py-2 text-sm outline-none focus:ring-2 focus:ring-steel/60"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-steel text-white font-medium text-sm rounded-md py-2.5 flex items-center justify-center gap-2 disabled:opacity-70 hover:brightness-110"
              >
                {submitting ? "Signing in…" : "Sign in"}
                {!submitting && <ArrowRight size={16} />}
              </button>
            </form>
          )}

          {step === "mfa" && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={18} className="text-steel" />
                <h1 className="font-display text-lg font-medium">Verify it&apos;s you</h1>
              </div>
              <p className="text-muted text-sm mb-6">
                MFA is mandatory for every platform account. Enter your 6-digit code.
              </p>

              {error && (
                <div role="alert" aria-live="assertive" className="mb-4 text-sm text-danger bg-danger/10 border border-danger/30 rounded-md px-3 py-2">
                  {error}
                </div>
              )}

              <div className="flex gap-2 mb-6">
                {mfaDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { mfaRefs.current[i] = el; }}
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    disabled={submitting}
                    onChange={(e) => handleMfaChange(i, e.target.value)}
                    onKeyDown={(e) => handleMfaKeyDown(i, e)}
                    aria-label={`Digit ${i + 1} of 6`}
                    className="w-full aspect-square text-center bg-pSurface2 border border-pBorder rounded-md text-lg font-mono outline-none focus:ring-2 focus:ring-steel/60"
                  />
                ))}
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-4">
                <ShieldCheck size={24} className="text-success" />
              </div>
              <h1 className="font-display text-lg font-medium mb-1">Signed in</h1>
              <p className="text-muted text-sm mb-6">Redirecting to the platform portal…</p>
              <button
                onClick={() => router.push("/platform")}
                className="inline-flex items-center gap-2 text-sm text-steel hover:underline"
              >
                Go to platform overview <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
