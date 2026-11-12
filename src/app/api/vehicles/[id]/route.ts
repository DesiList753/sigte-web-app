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
  status: z.enum(["APPROVED", "REJECTED"]).optional(),
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

  const { status, ...fields } = parsed.data;
  if (status === undefined) {
    if (fields.authorized && vehicle.status !== "APPROVED") {
      return jsonError(409, "La solicitud de este vehículo aún no ha sido aprobada");
    }
    const updated = await prisma.vehicle.update({ where: { id: vehicle.id }, data: fields });
    return NextResponse.json({ vehicle: updated });
  }

  if (session.role !== "ADMIN") return jsonError(403, "Solo un administrador puede responder la solicitud");
  const approved = status === "APPROVED";
  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.vehicle.update({
      where: { id: vehicle.id },
      data: { ...fields, status, authorized: approved },
    });
    await tx.notification.create({
      data: {
        organizationId: session.organizationId,
        userId: vehicle.ownerId,
        kind: "SYSTEM",
        title: approved ? "Vehículo aprobado" : "Vehículo rechazado",
        message: approved
          ? `Tu vehículo ${vehicle.plate} fue aprobado y ya puede ingresar.`
          : `La solicitud de tu vehículo ${vehicle.plate} fue rechazada. Consulta a la administración.`,
      },
    });
    await tx.auditLog.create({
      data: auditData({
        organizationId: session.organizationId,
        actor: session,
        action: "UPDATE",
        entity: "VEHICLE",
        entityId: vehicle.id,
        detail: { plate: vehicle.plate, request: approved ? "ACCEPTED" : "REJECTED" },
      }),
    });
    return saved;
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
