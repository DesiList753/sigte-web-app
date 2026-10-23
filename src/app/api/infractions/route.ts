import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson, withTenant } from "@/lib/api";

export const GET = withTenant(async (_req, { session }) => {
  const where: Prisma.InfractionWhereInput = { organizationId: session.organizationId };
  if (session.role === "USER") where.userId = session.sub;

  const infractions = await prisma.infraction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      vehicle: { select: { id: true, plate: true } },
      guard: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
  return NextResponse.json({ infractions });
}, { feature: "INFRACTIONS" });

const createSchema = z.object({
  vehicleId: z.string().optional(),
  plate: z.string().optional(),
  type: z.enum([
    "WRONG_BLOCK",
    "UNAUTHORIZED_ENTRY",
    "DOUBLE_PARKING",
    "EXPIRED_PERMIT",
    "BLOCKING_ACCESS",
    "SPEEDING",
    "OTHER",
  ]),
  description: z.string().min(3),
});

export const POST = withTenant(
  async (req, { session }) => {
    const parsed = await parseJson(req, createSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const organizationId = session.organizationId;

    let vehicle = null;
    if (body.vehicleId) {
      vehicle = await prisma.vehicle.findFirst({ where: { id: body.vehicleId, organizationId } });
    } else if (body.plate) {
      const plate = body.plate.toUpperCase().replace(/\s+/g, "");
      vehicle = await prisma.vehicle.findUnique({ where: { organizationId_plate: { organizationId, plate } } });
    }
    if (!vehicle) return jsonError(404, "Vehículo no encontrado");

    const infraction = await prisma.infraction.create({
      data: {
        organizationId,
        vehicleId: vehicle.id,
        userId: vehicle.ownerId,
        guardId: session.sub,
        type: body.type,
        description: body.description,
        status: "OPEN",
      },
    });

    const title = "Nueva infracción registrada";
    const message = `Patente ${vehicle.plate}: ${body.description}`;

    await prisma.notification.create({
      data: { organizationId, userId: vehicle.ownerId, title, message },
    });

    return NextResponse.json({ infraction }, { status: 201 });
  },
  { roles: ["GUARD", "ADMIN"], feature: "INFRACTIONS" }
);
