import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { homePath, setSessionCookie, verifyPassword } from "@/lib/auth";
import { signToken } from "@/lib/jwt";
import { jsonError, parseJson } from "@/lib/api";
import { LOCK_MS, isLocked, minutesRemaining, shouldLock } from "@/lib/loginPolicy";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  organizationSlug: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;

  const { email, password, organizationSlug } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { organization: { select: { status: true, slug: true } } },
  });
  if (!user || !user.active || (organizationSlug && user.organization?.slug !== organizationSlug)) {
    return jsonError(401, "Credenciales inválidas");
  }

  if (isLocked(user.lockedUntil)) {
    return jsonError(
      429,
      `Demasiados intentos fallidos. Intenta de nuevo en ${minutesRemaining(user.lockedUntil!)} minuto(s).`
    );
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const attempts = user.failedLoginAttempts + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: shouldLock(attempts)
        ? { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MS) }
        : { failedLoginAttempts: attempts },
    });
    return jsonError(401, "Credenciales inválidas");
  }

  if (user.role !== "SUPER_ADMIN" && user.organization?.status !== "ACTIVE") {
    return jsonError(403, "La cuenta de tu organización está suspendida", { code: "ORG_SUSPENDED" });
  }

  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  const token = await signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    organizationId: user.organizationId,
  });
  await setSessionCookie(token);

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
    home: homePath(user.role),
    token,
  });
}
