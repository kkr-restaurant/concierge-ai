export default function ConfigError({ portal }: { portal: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div
        role="alert"
        className="max-w-md w-full bg-surface border border-danger/40 rounded-card p-6"
      >
        <h1 className="font-display text-lg font-medium text-danger mb-2">
          Sign-in is temporarily unavailable
        </h1>
        <p className="text-sm text-muted">
          The {portal} sign-in isn&apos;t configured correctly on the server
          (missing Supabase settings). This isn&apos;t a problem with your
          account — please contact the platform team.
        </p>
      </div>
    </main>
  );
}
