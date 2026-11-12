import { createHash, randomBytes } from "crypto";

export const RESET_TOKEN_TTL_MS = 30 * 60_000;

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60_000;

/** Token de un solo uso, seguro para incluir en una URL. */
export function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Nunca se guarda el token crudo — solo su hash. */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
