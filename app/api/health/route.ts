import { NextResponse } from "next/server";

// Reports which required settings are PRESENT — never their values. Exists so
// a misconfigured deploy can be diagnosed from a browser without needing
// Cloudflare log access. Safe to delete once you have real monitoring.
export const dynamic = "force-dynamic";

const present = (v: string | undefined) => Boolean(v && v.trim().length > 0);

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const env = {
    NEXT_PUBLIC_SUPABASE_URL: present(url),
    // Catches typos like ".com" instead of ".co"
    NEXT_PUBLIC_SUPABASE_URL_format_ok: /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(url ?? ""),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: present(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: present(process.env.SUPABASE_SERVICE_ROLE_KEY),
    IMPERSONATION_JWT_SECRET: present(process.env.IMPERSONATION_JWT_SECRET)
  };

  const ok = Object.values(env).every(Boolean);
  return NextResponse.json({ ok, env }, { status: ok ? 200 : 503 });
}
