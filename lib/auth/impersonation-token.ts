import "server-only";
import { SignJWT, jwtVerify } from "jose";

export type ImpersonationClaims = {
  sessionId: string;
  tenantId: string;
  platformUserId: string;
};

function secretKey() {
  const secret = process.env.IMPERSONATION_JWT_SECRET;
  if (!secret) {
    throw new Error("IMPERSONATION_JWT_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Impersonation tokens are a deliberately separate token family from both
 * the platform-staff Supabase session and any tenant-staff Supabase
 * session (spec §13/§16 — population separation). Verifying one of these
 * only ever proves "a platform admin started a time-boxed, reason-coded
 * session for this specific tenant" — nothing more, and the
 * impersonation_sessions row (checked on every use, not just at mint time)
 * is the real source of truth for whether it's still valid.
 */
export async function signImpersonationToken(
  claims: ImpersonationClaims,
  expiresAt: Date
) {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("hotel-ai-platform:impersonation")
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey());
}

export async function verifyImpersonationToken(token: string) {
  const { payload } = await jwtVerify(token, secretKey(), {
    issuer: "hotel-ai-platform:impersonation"
  });
  return payload as ImpersonationClaims & { exp: number; iat: number };
}
