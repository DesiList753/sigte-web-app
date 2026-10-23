import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson, planError, withTenant } from "@/lib/api";
import { auditData } from "@/lib/audit";
import { limitBlock, limitKindFor } from "@/lib/plan";

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(["USER", "GUARD", "ADMIN"]).optional(),
  active: z.boolean().optional(),
  credentialId: z.string().optional(),
});

async function otherActiveAdmins(organizationId: string, userId: string) {
  return prisma.user.count({
    where: { organizationId, role: "ADMIN", active: true, NOT: { id: userId } },
  });
}

export const PATCH = withTenant<{ id: string }>(
  async (req, { session, params }) => {
    const parsed = await parseJson(req, patchSchema);
    if (!parsed.ok) return parsed.response;
    const { role, active, credentialId } = parsed.data;
    const organizationId = session.organizationId;

    const target = await prisma.user.findFirst({
      where: { id: params.id, organizationId },
      select: { id: true, email: true, role: true, active: true, credentialId: true },
    });
    if (!target) return jsonError(404, "Usuario no encontrado");

    const losesAdmin =
      target.role === "ADMIN" &&
      target.active &&
      ((role !== undefined && role !== "ADMIN") || active === false);
    if (losesAdmin && (await otherActiveAdmins(organizationId, target.id)) === 0) {
      return jsonError(409, "La organización debe tener al menos un administrador activo");
    }

    if (credentialId && credentialId !== target.credentialId) {
      const collision = await prisma.user.findUnique({
        where: { organizationId_credentialId: { organizationId, credentialId } },
      });
      if (collision) return jsonError(409, "La credencial ya existe en tu organización");
    }

    const finalKind = limitKindFor(role ?? target.role);
    const takesNewSeat =
      (active ?? target.active) && (!target.active || finalKind !== limitKindFor(target.role));
    if (takesNewSeat) {
      const limited = await limitBlock(organizationId, session.plan, finalKind);
      if (limited) return planError(limited);
    }

    const base = { organizationId, actor: session, entity: "USER" as const, entityId: target.id };
    const logs: Prisma.AuditLogCreateManyInput[] = [];
    if (role && role !== target.role) {
      logs.push(auditData({ ...base, action: "ROLE_CHANGE", detail: { email: target.email, from: target.role, to: role } }));
    }
    if (active !== undefined && active !== target.active) {
      logs.push(auditData({ ...base, action: "UPDATE", detail: { email: target.email, active } }));
    }

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: target.id },
        data: parsed.data,
        select: { id: true, email: true, name: true, role: true, active: true, credentialId: true },
      });
      if (logs.length) await tx.auditLog.createMany({ data: logs });
      return updated;
    });
    return NextResponse.json({ user });
  },
  { roles: ["ADMIN"] }
);

export const DELETE = withTenant<{ id: string }>(
  async (_req, { session, params }) => {
    if (params.id === session.sub) return jsonError(400, "No puedes eliminar tu propio usuario");

    const target = await prisma.user.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      select: { id: true, email: true, role: true },
    });
    if (!target) return jsonError(404, "Usuario no encontrado");

    const reported = await prisma.infraction.count({ where: { guardId: target.id } });
    if (reported > 0) {
      return jsonError(409, "No se puede eliminar porque registró infracciones. Desactívalo en su lugar.");
    }

    await prisma.$transaction([
      prisma.user.delete({ where: { id: target.id } }),
      prisma.auditLog.create({
        data: auditData({
          organizationId: session.organizationId,
          actor: session,
          action: "DELETE",
          entity: "USER",
          entityId: target.id,
          detail: { email: target.email, role: target.role },
        }),
      }),
    ]);
    return NextResponse.json({ ok: true });
  },
  { roles: ["ADMIN"] }
);
