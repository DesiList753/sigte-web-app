import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import { requireSecret } from "./env";

const SECRET = new TextEncoder().encode(requireSecret("JWT_SECRET", "dev-only-secret-replace"));
const ISSUER = process.env.JWT_ISSUER ?? "sigte.local";
const AUDIENCE = process.env.JWT_AUDIENCE ?? "sigte.app";

export const COOKIE_NAME = "sigte_session";

export type SessionPayload = {
  sub: string;
  email: string;
  role: Role;
  name: string;
  organizationId: string | null;
};

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime("7d")
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, { issuer: ISSUER, audience: AUDIENCE });
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      role: payload.role as Role,
      name: payload.name as string,
      organizationId: (payload.organizationId as string | null | undefined) ?? null,
    };
  } catch {
    return null;
  }
}
