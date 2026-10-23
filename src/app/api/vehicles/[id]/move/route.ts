import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson, withTenant } from "@/lib/api";

const moveSchema = z.object({
  blockId: z.string().min(1),
});

export const POST = withTenant<{ id: string }>(
  async (req, { session, params }) => {
    const parsed = await parseJson(req, moveSchema);
    if (!parsed.ok) return parsed.response;
    const organizationId = session.organizationId;

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: params.id, organizationId },
      include: { currentBlock: true },
    });
    if (!vehicle) return jsonError(404, "Vehículo no encontrado");
    if (!vehicle.currentBlockId)
      return jsonError(400, "El vehículo no está dentro del estacionamiento");

    const target = await prisma.parkingBlock.findFirst({
      where: { id: parsed.data.blockId, organizationId },
    });
    if (!target) return jsonError(404, "Bloque destino no encontrado");

    if (vehicle.currentBlockId === target.id)
      return jsonError(400, "El vehículo ya está en ese bloque");

    const from = vehicle.currentBlock?.name ?? "—";

    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { currentBlockId: target.id },
    });

    await prisma.accessLog.create({
      data: {
        organizationId,
        vehicleId: vehicle.id,
        userId: vehicle.ownerId,
        guardId: session.sub,
        method: "MANUAL",
        direction: "IN",
        blockId: target.id,
        authorized: vehicle.authorized,
        note: `Reubicado desde ${from} → ${target.name}`,
      },
    });

    return NextResponse.json({
      ok: true,
      vehicle: { id: vehicle.id, plate: vehicle.plate },
      from,
      to: target.name,
    });
  },
  { roles: ["GUARD", "ADMIN"] }
);
