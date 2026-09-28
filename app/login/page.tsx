import LoginClient from "./LoginClient";

// Rendered per-request (never prerendered at build time). It reads the
// Supabase URL/anon key from the Worker's RUNTIME environment and hands them
// to the client component as props, so the browser never depends on values
// being baked in at build time (Cloudflare's build doesn't have them).
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <LoginClient
      supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL}
      supabaseAnonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}
    />
  );
}
