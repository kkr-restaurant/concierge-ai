import PlatformLoginClient from "./PlatformLoginClient";

// See app/login/page.tsx for why this is forced dynamic.
export const dynamic = "force-dynamic";

export default function PlatformLoginPage() {
  return <PlatformLoginClient />;
}
