"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Eye,
  EyeOff,
  Mail,
  Lock,
  ShieldCheck,
  ArrowRight
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type Step = "credentials" | "mfa" | "success";

export default function LoginPage() {
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

    // Unlike the platform side, MFA here is opt-in per hotel (Authentication
    // settings → "Require for all users"). If this account has no enrolled
    // TOTP factor, skip straight to success rather than forcing a step that
    // isn't configured for them.
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const totpFactor = factorsData?.totp?.[0];

    if (!totpFactor) {
      setSubmitting(false);
      setStep("success");
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

    if (value && index < 5) {
      mfaRefs.current[index + 1]?.focus();
    }
    if (next.every((d) => d !== "") && next.join("").length === 6) {
      verifyMfa(next.join(""));
    }
  }

  function handleMfaKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !mfaDigits[index] && index > 0) {
      mfaRefs.current[index - 1]?.focus();
    }
  }

  function handleMfaPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      setMfaDigits(pasted.split(""));
      verifyMfa(pasted);
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

    setSubmitting(false);
    if (verifyError) {
      setError("Incorrect code. Try again.");
      setMfaDigits(["", "", "", "", "", ""]);
      mfaRefs.current[0]?.focus();
      return;
    }

    setStep("success");
  }

  return (
    <main className="min-h-screen grid md:grid-cols-2">
      <section className="hidden md:flex flex-col justify-between bg-surface p-12 border-r border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-brass flex items-center justify-center">
            <Building2 size={18} className="text-ink" />
          </div>
          <span className="font-display font-medium text-lg">Hotel AI Platform</span>
        </div>
        <div>
          <p className="font-display text-3xl leading-snug max-w-sm">
            Every guest message, every property, one console.
          </p>
          <p className="text-muted mt-4 max-w-sm text-sm">
            Manage AI-assisted conversations across WhatsApp and your website widget,
            with enterprise-grade access control behind every screen.
          </p>
        </div>
        <p className="text-xs text-muted font-mono">v1.0.0-authentication</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-surface rounded-card border border-border overflow-hidden">
          <div className="keycard-stripe" />
          <div className="p-8">
            {step === "credentials" && (
              <form onSubmit={handleCredentialSubmit} noValidate>
                <h1 className="font-display text-xl font-medium mb-1">Sign in</h1>
                <p className="text-muted text-sm mb-6">Your hotel account</p>

                {error && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="mb-4 text-sm text-danger bg-danger/10 border border-danger/30 rounded-md px-3 py-2"
                  >
                    {error}
                  </div>
                )}

                <label htmlFor="email" className="text-xs text-muted mb-1 block">
                  Email
                </label>
                <div className="relative mb-4">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="you@hotel.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-surface2 border border-border rounded-md pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brass/60"
                  />
                </div>

                <label htmlFor="password" className="text-xs text-muted mb-1 block">
                  Password
                </label>
                <div className="relative mb-2">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-surface2 border border-border rounded-md pl-9 pr-9 py-2 text-sm outline-none focus:ring-2 focus:ring-brass/60"
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

                <div className="flex justify-end mb-6">
                  <a href="#" className="text-xs text-brass hover:underline">
                    Forgot password?
                  </a>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className={`keycard-swipe w-full bg-brass text-ink font-medium text-sm rounded-md py-2.5 flex items-center justify-center gap-2 disabled:opacity-70 ${submitting ? "" : "hover:brightness-110"}`}
                >
                  {submitting ? "Signing in…" : "Sign in"}
                  {!submitting && <ArrowRight size={16} />}
                </button>
              </form>
            )}

            {step === "mfa" && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck size={18} className="text-brass" />
                  <h1 className="font-display text-xl font-medium">Verify it&apos;s you</h1>
                </div>
                <p className="text-muted text-sm mb-6">
                  Enter the 6-digit code from your authenticator app.
                </p>

                {error && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="mb-4 text-sm text-danger bg-danger/10 border border-danger/30 rounded-md px-3 py-2"
                  >
                    {error}
                  </div>
                )}

                <div className="flex gap-2 mb-6" onPaste={handleMfaPaste}>
                  {mfaDigits.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        mfaRefs.current[i] = el;
                      }}
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      disabled={submitting}
                      onChange={(e) => handleMfaChange(i, e.target.value)}
                      onKeyDown={(e) => handleMfaKeyDown(i, e)}
                      aria-label={`Digit ${i + 1} of 6`}
                      className="w-full aspect-square text-center bg-surface2 border border-border rounded-md text-lg font-mono outline-none focus:ring-2 focus:ring-brass/60"
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
                <h1 className="font-display text-xl font-medium mb-1">Signed in</h1>
                <p className="text-muted text-sm mb-6">Redirecting to your dashboard…</p>
                <button
                  onClick={() => router.push("/settings/authentication")}
                  className="inline-flex items-center gap-2 text-sm text-brass hover:underline"
                >
                  Go to authentication settings <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
