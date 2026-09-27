import LoginClient from "./LoginClient";

// This page creates a Supabase browser client on render, which needs real
// env vars present. Forcing it dynamic means Next.js renders it at request
// time in the Worker (where the runtime environment variables are already
// set), instead of trying to prerender it during the build step (where
// they may not be, depending on the host's build-vs-runtime var handling).
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginClient />;
}
