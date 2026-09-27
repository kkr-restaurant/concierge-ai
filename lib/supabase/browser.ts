"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Client-side Supabase client — safe to use in "use client" components.
 * Uses the anon key only; RLS governs what it can read/write.
 */
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
