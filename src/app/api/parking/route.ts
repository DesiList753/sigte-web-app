import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson, planError, withTenant } from "@/lib/api";
import { auditData } from "@/lib/audit";
import { loadBlockingEventsByBlock } from "@/lib/events";
import { limitBlock } from "@/lib/plan";

export const GET = withTenant(async (_req, { session }) => {
  const organizationId = session.organizationId;
  const [org, blocks, insideCount, blockingByBlock] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { defaultBlockId: true } }),
    prisma.parkingBlock.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      include: { _count: { select: { vehicles: true } } },
    }),
    prisma.vehicle.count({ where: { organizationId, currentBlockId: { not: null } } }),
    loadBlockingEventsByBlock(organizationId),
  ]);

  const defaultBlockId = org?.defaultBlockId ?? null;
  const totalCapacity = blocks.reduce((sum, b) => sum + b.capacity, 0);
  const ordered = [...blocks].sort(
    (a, b) => Number(b.id === defaultBlockId) - Number(a.id === defaultBlockId)
  );

  const mappedBlocks = ordered.map((b) => {
    const active = b.active !== false;
    const blockingEvent = blockingByBlock.get(b.id) ?? null;
    const entryAllowed = active && !blockingEvent;
    const closedReason = !active
      ? "Bloque desactivado"
      : blockingEvent
      ? blockingEvent.title
      : null;
    return {
      id: b.id,
      name: b.name,
      description: b.description,
      capacity: b.capacity,
      active,
      entryAllowed,
      closedReason,
      blockingEvent,
      isDefault: b.id === defaultBlockId,
      occupied: b._count.vehicles,
      free: entryAllowed ? Math.max(0, b.capacity - b._count.vehicles) : 0,
    };
  });

  const hasClosedBlock = mappedBlocks.some((b) => !b.entryAllowed);
  const freeTotal = hasClosedBlock
    ? mappedBlocks.reduce((sum, b) => sum + b.free, 0)
    : Math.max(0, totalCapacity - insideCount);

  return NextResponse.json({
    blocks: mappedBlocks,
    totals: {
      inside: insideCount,
      capacity: totalCapacity,
      free: freeTotal,
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
