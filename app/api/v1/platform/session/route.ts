import { NextResponse } from "next/server";
import { requirePlatformUser } from "@/lib/auth/require-platform";

export async function GET() {
  const guard = await requirePlatformUser();
  if (!guard.ok) return guard.response;
  return NextResponse.json({ platform_user: guard.platformUser });
}
