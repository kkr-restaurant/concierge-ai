import SignupClient from "./SignupClient";

// Same reasoning as app/login/page.tsx: creates a Supabase browser client
// on render, so this must never be prerendered at build time.
export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <SignupClient
      supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL}
      supabaseAnonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}
    />
  );
}
