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
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      platformAdmin: true,
      failedLoginAttempts: true,
      lockedUntil: true,
      lastOrganizationId: true,
      memberships: {
        where: { active: true },
        orderBy: { createdAt: "asc" },
        select: { role: true, organizationId: true, organization: { select: { slug: true, status: true } } },
      },
    },
  });

  const memberships = organizationSlug
    ? (user?.memberships ?? []).filter((m) => m.organization.slug === organizationSlug)
    : (user?.memberships ?? []);
  const platform = !!user?.platformAdmin && !organizationSlug;
  if (!user || (!platform && memberships.length === 0)) return jsonError(401, "Credenciales inválidas");

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

  const available = memberships.filter((m) => m.organization.status === "ACTIVE");
  if (!platform && available.length === 0) {
    return jsonError(403, "La cuenta de tu organización está suspendida", { code: "ORG_SUSPENDED" });
  }
  const chosen = platform
    ? null
    : (available.find((m) => m.organizationId === user.lastOrganizationId) ?? available[0]);

  const role = chosen?.role ?? "SUPER_ADMIN";
  const organizationId = chosen?.organizationId ?? null;
  const resetLock = user.failedLoginAttempts > 0 || !!user.lockedUntil;
  const changesLast = !!organizationId && organizationId !== user.lastOrganizationId;
  if (resetLock || changesLast) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(resetLock ? { failedLoginAttempts: 0, lockedUntil: null } : {}),
        ...(changesLast ? { lastOrganizationId: organizationId } : {}),
      },
    });
  }

  const token = await signToken({ sub: user.id, email: user.email, role, name: user.name, organizationId });
  await setSessionCookie(token);

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role,
    organizationId,
    home: homePath(role),
  });
}
