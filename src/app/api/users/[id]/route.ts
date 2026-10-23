import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson, withTenant } from "@/lib/api";

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(["USER", "GUARD", "ADMIN"]).optional(),
  active: z.boolean().optional(),
  universityId: z.string().optional(),
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
    const { role, active, universityId } = parsed.data;
    const organizationId = session.organizationId;

    const target = await prisma.user.findFirst({
      where: { id: params.id, organizationId },
      select: { id: true, role: true, active: true, universityId: true },
    });
    if (!target) return jsonError(404, "Usuario no encontrado");

    const losesAdmin =
      target.role === "ADMIN" &&
      target.active &&
      ((role !== undefined && role !== "ADMIN") || active === false);
    if (losesAdmin && (await otherActiveAdmins(organizationId, target.id)) === 0) {
      return jsonError(409, "La organización debe tener al menos un administrador activo");
    }

    if (universityId && universityId !== target.universityId) {
      const collision = await prisma.user.findUnique({
        where: { organizationId_universityId: { organizationId, universityId } },
      });
      if (collision) return jsonError(409, "La credencial ya existe en tu organización");
    }

    const user = await prisma.user.update({
      where: { id: target.id },
      data: parsed.data,
      select: { id: true, email: true, name: true, role: true, active: true, universityId: true },
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
      select: { id: true },
    });
    if (!target) return jsonError(404, "Usuario no encontrado");

    const reported = await prisma.infraction.count({ where: { guardId: target.id } });
    if (reported > 0) {
      return jsonError(409, "No se puede eliminar porque registró infracciones. Desactívalo en su lugar.");
    }

    await prisma.user.delete({ where: { id: target.id } });
    return NextResponse.json({ ok: true });
  },
  { roles: ["ADMIN"] }
);
