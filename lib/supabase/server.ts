import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client scoped to the calling user's session cookie.
 * Use this (not the admin client) whenever "who is making this request"
 * should matter — RLS applies. Route Handlers that need to bypass RLS for a
 * privileged write (e.g. suspending a tenant after a role check) should
 * still call this first to establish *who* is asking, then use
 * lib/supabase/admin.ts for the actual write.
 *
 * Next.js 15 made `cookies()` async — this function is async to match.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Called from a Server Component with no response to attach
            // cookies to — middleware.ts handles session refresh instead.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // See note above.
          }
        }
      }
    }
  );
}
