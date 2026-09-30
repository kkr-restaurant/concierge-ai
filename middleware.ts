import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Standard Supabase session-refresh middleware. This does NOT do the
 * population/role check — that lives in lib/auth/require-platform.ts and
 * runs per-route, because different /api/v1/platform/* endpoints need
 * different role sets (see each route's `allowedRoles`). This middleware's
 * only job is keeping the auth cookie fresh so those checks see a valid
 * session.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    // Misconfigured deploy: skip the session refresh rather than throwing,
    // which would turn every matched route into a blank 500. Pages show a
    // clear error and /api/health reports what's missing.
    console.error("middleware: Supabase env vars missing — skipping session refresh");
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        }
      }
    }
  );

  await supabase.auth.getSession();
  return response;
}

export const config = {
  matcher: [
    "/api/v1/platform/:path*",
    "/platform/:path*",
    "/settings/:path*",
    "/api/v1/tenants/:path*",
    "/dashboard/:path*"
  ]
};
