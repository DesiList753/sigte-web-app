import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson, planError, withTenant } from "@/lib/api";
import { auditData } from "@/lib/audit";
import { memberByCredential } from "@/lib/members";
import { limitBlock, limitKindFor } from "@/lib/plan";

const patchSchema = z.object({
  role: z.enum(["USER", "GUARD", "ADMIN"]).optional(),
  active: z.boolean().optional(),
  credentialId: z.string().optional(),
});

function findMember(userId: string, organizationId: string) {
  return prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { id: true, role: true, active: true, credentialId: true, user: { select: { email: true } } },
  });
}

async function otherActiveAdmins(organizationId: string, userId: string) {
  return prisma.membership.count({
    where: { organizationId, role: "ADMIN", active: true, NOT: { userId } },
  });
}

export const PATCH = withTenant<{ id: string }>(
  async (req, { session, params }) => {
    const parsed = await parseJson(req, patchSchema);
    if (!parsed.ok) return parsed.response;
    const { role, active, credentialId } = parsed.data;
    const organizationId = session.organizationId;

    const target = await findMember(params.id, organizationId);
    if (!target) return jsonError(404, "Usuario no encontrado");
    const email = target.user.email;

    const losesAdmin =
      target.role === "ADMIN" &&
      target.active &&
      ((role !== undefined && role !== "ADMIN") || active === false);
    if (losesAdmin && (await otherActiveAdmins(organizationId, params.id)) === 0) {
      return jsonError(409, "La organización debe tener al menos un administrador activo");
    }

    if (
      credentialId &&
      credentialId !== target.credentialId &&
      (await memberByCredential(organizationId, credentialId))
    ) {
      return jsonError(409, "La credencial ya existe en tu organización");
    }

    const finalKind = limitKindFor(role ?? target.role);
    const takesNewSeat =
      (active ?? target.active) && (!target.active || finalKind !== limitKindFor(target.role));
    if (takesNewSeat) {
      const limited = await limitBlock(organizationId, session.plan, finalKind);
      if (limited) return planError(limited);
    }

    const base = { organizationId, actor: session, entity: "USER" as const, entityId: params.id };
    const logs: Prisma.AuditLogCreateManyInput[] = [];
    if (role && role !== target.role) {
      logs.push(auditData({ ...base, action: "ROLE_CHANGE", detail: { email, from: target.role, to: role } }));
    }
    if (active !== undefined && active !== target.active) {
      logs.push(auditData({ ...base, action: "UPDATE", detail: { email, active } }));
    }

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.membership.update({
        where: { id: target.id },
        data: parsed.data,
        select: {
          role: true,
          active: true,
          credentialId: true,
          user: { select: { id: true, email: true, name: true } },
        },
      });
      if (logs.length) await tx.auditLog.createMany({ data: logs });
      const { user: person, ...membership } = updated;
      return { ...person, ...membership };
    });
    return NextResponse.json({ user });
  },
  { roles: ["ADMIN"] }
);

export const DELETE = withTenant<{ id: string }>(
  async (_req, { session, params }) => {
    if (params.id === session.sub) return jsonError(400, "No puedes quitarte a ti mismo de la organización");
    const organizationId = session.organizationId;

    const target = await findMember(params.id, organizationId);
    if (!target) return jsonError(404, "Usuario no encontrado");

    const reported = await prisma.infraction.count({ where: { guardId: params.id, organizationId } });
    if (reported > 0) {
      return jsonError(409, "No se puede quitar porque registró infracciones. Desactívalo en su lugar.");
    }

    await prisma.$transaction([
      prisma.vehicle.deleteMany({ where: { ownerId: params.id, organizationId } }),
      prisma.notification.deleteMany({ where: { userId: params.id, organizationId } }),
      prisma.membership.delete({ where: { id: target.id } }),
      prisma.auditLog.create({
        data: auditData({
          organizationId,
          actor: session,
          action: "DELETE",
          entity: "USER",
          entityId: params.id,
          detail: { email: target.user.email, role: target.role },
        }),
      }),
    ]);
    return NextResponse.json({ ok: true });
  },
  { roles: ["ADMIN"] }
);
