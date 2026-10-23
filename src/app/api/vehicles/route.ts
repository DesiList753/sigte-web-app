import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson, planError, withTenant } from "@/lib/api";
import { auditData } from "@/lib/audit";
import { ownerSelect, withFlatOwner } from "@/lib/members";
import { limitBlock } from "@/lib/plan";

export const GET = withTenant(async (req, { session }) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const plate = url.searchParams.get("plate")?.toUpperCase().trim();
  const inside = url.searchParams.get("inside") === "true";
  const blockId = url.searchParams.get("blockId");

  const where: Prisma.VehicleWhereInput = { organizationId: session.organizationId };
  if (session.role === "USER") where.ownerId = session.sub;

  if (q) {
    const upper = q.toUpperCase();
    where.OR = [
      { plate: { contains: upper } },
      { owner: { name: { contains: q, mode: "insensitive" } } },
      { owner: { email: { contains: q.toLowerCase() } } },
      { owner: { rut: { contains: q } } },
    ];
  } else if (plate) {
    where.plate = { contains: plate };
  }

  if (inside) where.currentBlockId = { not: null };
  if (blockId) where.currentBlockId = blockId;

  const vehicles = await prisma.vehicle.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: ownerSelect(session.organizationId) },
      currentBlock: true,
    },
  });
  return NextResponse.json({ vehicles: vehicles.map(withFlatOwner) });
});

const createSchema = z.object({
  plate: z.string().min(3).max(12),
  make: z.string().optional(),
  model: z.string().optional(),
  color: z.string().optional(),
  ownerId: z.string().optional(),
  authorized: z.boolean().optional(),
});

export const POST = withTenant(async (req, { session }) => {
  const parsed = await parseJson(req, createSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;
  const organizationId = session.organizationId;

  let ownerId = session.sub;
  if (session.role === "ADMIN" && data.ownerId) {
    const member = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: data.ownerId, organizationId } },
      select: { userId: true },
    });
    if (!member) return jsonError(404, "Dueño no encontrado");
    ownerId = member.userId;
  }

  const plate = data.plate.toUpperCase().replace(/\s+/g, "");
  const existing = await prisma.vehicle.findUnique({
    where: { organizationId_plate: { organizationId, plate } },
  });
  if (existing) return jsonError(409, "Patente ya registrada");

  const limited = await limitBlock(organizationId, session.plan, "vehicles");
  if (limited) return planError(limited);

  const vehicle = await prisma.$transaction(async (tx) => {
    const created = await tx.vehicle.create({
      data: {
        organizationId,
        plate,
        make: data.make,
        model: data.model,
        color: data.color,
        authorized: session.role === "USER" ? undefined : data.authorized,
        ownerId,
      },
      include: { owner: { select: { id: true, name: true, email: true } } },
    });
    await tx.auditLog.create({
      data: auditData({
        organizationId,
        actor: session,
        action: "CREATE",
        entity: "VEHICLE",
        entityId: created.id,
        detail: { plate },
      }),
    });
    return created;
  });
  return NextResponse.json({ vehicle }, { status: 201 });
});
