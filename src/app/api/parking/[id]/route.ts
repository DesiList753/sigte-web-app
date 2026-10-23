import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson, withTenant } from "@/lib/api";
import { auditData } from "@/lib/audit";

const updateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  capacity: z.number().int().min(1).optional(),
  isDefault: z.boolean().optional(),
});

export const PATCH = withTenant<{ id: string }>(
  async (req, { session, params }) => {
    const parsed = await parseJson(req, updateSchema);
    if (!parsed.ok) return parsed.response;
    const { isDefault, ...data } = parsed.data;
    const organizationId = session.organizationId;

    const target = await prisma.parkingBlock.findFirst({
      where: { id: params.id, organizationId },
      include: { defaultOf: { select: { id: true } } },
    });
    if (!target) return jsonError(404, "Bloque no encontrado");

    if (isDefault === false && target.defaultOf) {
      return jsonError(400, "Debe haber un bloque por defecto. Marca otro bloque como predeterminado.");
    }

    if (data.name && data.name !== target.name) {
      const clash = await prisma.parkingBlock.findUnique({
        where: { organizationId_name: { organizationId, name: data.name } },
      });
      if (clash) return jsonError(409, "Ya existe un bloque con ese nombre");
    }

    const block = await prisma.parkingBlock.update({
      where: { id: target.id },
      data: {
        ...data,
        ...(isDefault ? { defaultOf: { connect: { id: organizationId } } } : {}),
      },
    });
    return NextResponse.json({ block: { ...block, isDefault: isDefault ?? Boolean(target.defaultOf) } });
  },
  { roles: ["ADMIN"] }
);

export const DELETE = withTenant<{ id: string }>(
  async (_req, { session, params }) => {
    const organizationId = session.organizationId;
    const [target, org] = await Promise.all([
      prisma.parkingBlock.findFirst({ where: { id: params.id, organizationId } }),
      prisma.organization.findUnique({ where: { id: organizationId }, select: { defaultBlockId: true } }),
    ]);
    if (!target) return jsonError(404, "Bloque no encontrado");
    if (target.id === org?.defaultBlockId)
      return jsonError(400, "No se puede eliminar el bloque por defecto. Asigná otro como default primero.");

    await prisma.$transaction([
      prisma.vehicle.updateMany({
        where: { organizationId, currentBlockId: target.id },
        data: { currentBlockId: org?.defaultBlockId ?? null },
      }),
      prisma.parkingBlock.delete({ where: { id: target.id } }),
      prisma.auditLog.create({
        data: auditData({
          organizationId,
          actor: session,
          action: "DELETE",
          entity: "PARKING_BLOCK",
          entityId: target.id,
          detail: { name: target.name },
        }),
      }),
    ]);
    return NextResponse.json({ ok: true });
  },
  { roles: ["ADMIN"] }
);
