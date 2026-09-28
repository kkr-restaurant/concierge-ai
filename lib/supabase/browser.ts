"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Client-side Supabase client — safe to use in "use client" components.
 * Uses the anon key only; RLS governs what it can read/write.
 *
 * The URL and anon key are passed in (from a server component reading the
 * Worker's runtime environment) instead of read from process.env here.
 * Anything read via process.env.NEXT_PUBLIC_* in browser code is baked into
 * the JS bundle at BUILD time — and Cloudflare's build environment doesn't
 * have those values — so the browser would get `undefined` and crash.
 */
export function createBrowserSupabaseClient(url: string, anonKey: string) {
  return createBrowserClient(url, anonKey);
}
