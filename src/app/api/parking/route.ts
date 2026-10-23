import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson, planError, withTenant } from "@/lib/api";
import { auditData } from "@/lib/audit";
import { limitBlock } from "@/lib/plan";

export const GET = withTenant(async (_req, { session }) => {
  const organizationId = session.organizationId;
  const [org, blocks, insideCount] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { defaultBlockId: true } }),
    prisma.parkingBlock.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      include: { _count: { select: { vehicles: true } } },
    }),
    prisma.vehicle.count({ where: { organizationId, currentBlockId: { not: null } } }),
  ]);

  const defaultBlockId = org?.defaultBlockId ?? null;
  const totalCapacity = blocks.reduce((sum, b) => sum + b.capacity, 0);
  const ordered = [...blocks].sort(
    (a, b) => Number(b.id === defaultBlockId) - Number(a.id === defaultBlockId)
  );

  return NextResponse.json({
    blocks: ordered.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      capacity: b.capacity,
      isDefault: b.id === defaultBlockId,
      occupied: b._count.vehicles,
      free: Math.max(0, b.capacity - b._count.vehicles),
    })),
    totals: {
      inside: insideCount,
      capacity: totalCapacity,
      free: Math.max(0, totalCapacity - insideCount),
      defaultBlockId,
    },
  });
});

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  capacity: z.number().int().min(1),
  isDefault: z.boolean().optional(),
});

export const POST = withTenant(
  async (req, { session }) => {
    const parsed = await parseJson(req, createSchema);
    if (!parsed.ok) return parsed.response;
    const { isDefault, ...data } = parsed.data;
    const organizationId = session.organizationId;

    const existing = await prisma.parkingBlock.findUnique({
      where: { organizationId_name: { organizationId, name: data.name } },
    });
    if (existing) return jsonError(409, "Ya existe un bloque con ese nombre");

    const limited = await limitBlock(organizationId, session.plan, "blocks");
    if (limited) return planError(limited);

    const block = await prisma.$transaction(async (tx) => {
      const created = await tx.parkingBlock.create({
        data: {
          ...data,
          organizationId,
          ...(isDefault ? { defaultOf: { connect: { id: organizationId } } } : {}),
        },
      });
      await tx.auditLog.create({
        data: auditData({
          organizationId,
          actor: session,
          action: "CREATE",
          entity: "PARKING_BLOCK",
          entityId: created.id,
          detail: { name: created.name },
        }),
      });
      return created;
    });
    return NextResponse.json({ block: { ...block, isDefault: Boolean(isDefault) } }, { status: 201 });
  },
  { roles: ["ADMIN"] }
);
