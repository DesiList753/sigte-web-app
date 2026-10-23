import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson, withTenant } from "@/lib/api";
import { auditData } from "@/lib/audit";

const updateSchema = z.object({
  make: z.string().optional(),
  model: z.string().optional(),
  color: z.string().optional(),
  authorized: z.boolean().optional(),
});

export const PATCH = withTenant<{ id: string }>(async (req, { session, params }) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: params.id, organizationId: session.organizationId },
  });
  if (!vehicle) return jsonError(404, "Vehículo no encontrado");

  if (session.role === "USER" && vehicle.ownerId !== session.sub)
    return jsonError(403, "No puedes editar este vehículo");

  const parsed = await parseJson(req, updateSchema);
  if (!parsed.ok) return parsed.response;

  if (session.role === "USER" && parsed.data.authorized !== undefined)
    return jsonError(403, "Solo un guardia o administrador puede cambiar la autorización");

  const updated = await prisma.vehicle.update({
    where: { id: vehicle.id },
    data: parsed.data,
  });
  return NextResponse.json({ vehicle: updated });
});

export const DELETE = withTenant<{ id: string }>(async (_req, { session, params }) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: params.id, organizationId: session.organizationId },
  });
  if (!vehicle) return jsonError(404, "Vehículo no encontrado");

  if (session.role === "USER" && vehicle.ownerId !== session.sub)
    return jsonError(403, "No puedes eliminar este vehículo");

  await prisma.$transaction([
    prisma.vehicle.delete({ where: { id: vehicle.id } }),
    prisma.auditLog.create({
      data: auditData({
        organizationId: session.organizationId,
        actor: session,
        action: "DELETE",
        entity: "VEHICLE",
        entityId: vehicle.id,
        detail: { plate: vehicle.plate },
      }),
    }),
  ]);
  return NextResponse.json({ ok: true });
});
