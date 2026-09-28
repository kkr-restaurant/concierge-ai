import PlatformLoginClient from "./PlatformLoginClient";

// See app/login/page.tsx for why this is dynamic and reads env at request time.
export const dynamic = "force-dynamic";

export default function PlatformLoginPage() {
  return (
    <PlatformLoginClient
      supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL}
      supabaseAnonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}
    />
  );
}
