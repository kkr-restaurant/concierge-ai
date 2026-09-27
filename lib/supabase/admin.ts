import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS entirely.
 *
 * `import "server-only"` makes any accidental client-side import a build
 * error rather than a leaked secret — this must only ever run in Route
 * Handlers, after a caller has already been verified as a platform user
 * with the right role (see lib/auth/require-platform.ts).
 */
export function createAdminSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
