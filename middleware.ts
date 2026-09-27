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

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
    "/settings/:path*"
  ]
};
