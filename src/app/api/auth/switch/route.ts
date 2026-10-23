import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest, homePath, resolveActor, setSessionCookie } from "@/lib/auth";
import { signToken } from "@/lib/jwt";
import { jsonError, parseJson } from "@/lib/api";

const schema = z.object({ organizationId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const actor = await resolveActor(await getSessionFromRequest(req));
  if (!actor || actor.role === "SUPER_ADMIN") return jsonError(401, "No autenticado");

  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;
  const { organizationId } = parsed.data;

  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: actor.id, organizationId } },
    select: { role: true, active: true, organization: { select: { status: true } } },
  });
  if (!membership?.active) return jsonError(404, "No perteneces a esa organización");
  if (membership.organization.status !== "ACTIVE") {
    return jsonError(403, "La cuenta de esa organización está suspendida", { code: "ORG_SUSPENDED" });
  }

  await prisma.user.update({ where: { id: actor.id }, data: { lastOrganizationId: organizationId } });
  const token = await signToken({
    sub: actor.id,
    email: actor.email,
    role: membership.role,
    name: actor.name,
    organizationId,
  });
  await setSessionCookie(token);
  return NextResponse.json({ home: homePath(membership.role) });
}
