import { NextResponse } from "next/server";
import { z } from "zod";
import type { EventKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson, withTenant } from "@/lib/api";
import { auditData } from "@/lib/audit";
import {
  activeEventsWhere,
  EVENT_BLOCKS_INCLUDE,
  buildEventNotificationMessage,
  eventBlocksView,
  eventPhase,
  resolveAudienceUserIds,
} from "@/lib/events";

const KIND_ORDER: Record<EventKind, number> = {
  EMERGENCY: 4,
  MAINTENANCE: 3,
  EVENT: 2,
  NOTICE: 1,
};

export const GET = withTenant(async (req, { session }) => {
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope");
  const organizationId = session.organizationId;
  const now = new Date();

  if (scope === "active") {
    const activeEvents = await prisma.parkingEvent.findMany({
      where: {
        ...activeEventsWhere(organizationId, now),
        showBanner: true,
      },
      orderBy: { createdAt: "desc" },
      include: EVENT_BLOCKS_INCLUDE,
    });

    let userBlockIds: Set<string> | null = null;
    if (
      session.role === "USER" &&
      activeEvents.some((ev) => ev.audience === "AFFECTED_VEHICLES")
    ) {
      const vehicles = await prisma.vehicle.findMany({
        where: { organizationId, ownerId: session.sub, currentBlockId: { not: null } },
        select: { currentBlockId: true },
      });
      userBlockIds = new Set(
        vehicles.map((v) => v.currentBlockId).filter((id): id is string => Boolean(id))
      );
    }

    const visible = activeEvents
      .filter((ev) => {
        if (session.role !== "USER") return true;
        if (ev.audience === "GUARDS") return false;
        if (ev.audience === "AFFECTED_VEHICLES") {
          return ev.blocks.some((b) => userBlockIds?.has(b.block.id));
        }
        return true;
      })
      .sort((a, b) => KIND_ORDER[b.kind] - KIND_ORDER[a.kind])
      .map((ev) => ({
        id: ev.id,
        title: ev.title,
        description: ev.description,
        kind: ev.kind,
        disableEntry: ev.disableEntry,
        startsAt: ev.startsAt,
        endsAt: ev.endsAt,
        blocks: eventBlocksView(ev.blocks),
      }));

    return NextResponse.json({ events: visible });
  }

  if (session.role === "USER") {
    return jsonError(403, "Acceso denegado para el rol USER");
  }

  const events = await prisma.parkingEvent.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      ...EVENT_BLOCKS_INCLUDE,
      createdBy: { select: { id: true, name: true } },
      _count: { select: { notifications: true } },
    },
  });

  return NextResponse.json({
    events: events.map((ev) => ({
      id: ev.id,
      title: ev.title,
      description: ev.description,
      kind: ev.kind,
      status: ev.status,
      phase: eventPhase(ev, now),
      disableEntry: ev.disableEntry,
      showBanner: ev.showBanner,
      audience: ev.audience,
      startsAt: ev.startsAt,
      endsAt: ev.endsAt,
      endedAt: ev.endedAt,
      createdAt: ev.createdAt,
      createdBy: ev.createdBy,
      blocks: eventBlocksView(ev.blocks),
      notifiedCount: ev._count.notifications,
    })),
  });
});

const createEventSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(3).max(1000),
  kind: z.enum(["EVENT", "EMERGENCY", "MAINTENANCE", "NOTICE"]).default("EVENT"),
  blockIds: z.array(z.string().min(1)).default([]),
  disableEntry: z.boolean().default(true),
  showBanner: z.boolean().default(true),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  notify: z.boolean().default(true),
  audience: z.enum(["ALL", "USERS", "GUARDS", "AFFECTED_VEHICLES"]).default("ALL"),
});

export const POST = withTenant(
  async (req, { session }) => {
    const parsed = await parseJson(req, createEventSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const organizationId = session.organizationId;

    const now = new Date();
    const startsAt = body.startsAt ? new Date(body.startsAt) : now;
    const endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
      return jsonError(400, "La fecha de término debe ser posterior a la de inicio");
    }

    const blockIds = Array.from(new Set(body.blockIds));
    if (body.audience === "AFFECTED_VEHICLES" && blockIds.length === 0) {
      return jsonError(400, "Selecciona al menos un bloque para notificar a vehículos afectados");
    }

    let blockNames: string[] = [];
    if (blockIds.length > 0) {
      const blocks = await prisma.parkingBlock.findMany({
        where: { organizationId, id: { in: blockIds } },
        select: { id: true, name: true },
      });
      if (blocks.length !== blockIds.length) {
        return jsonError(404, "Uno o más bloques seleccionados no existen en tu organización");
      }
      blockNames = blocks.map((b) => b.name);
    }

    const disableEntry = blockIds.length > 0 ? body.disableEntry : false;

    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.parkingEvent.create({
        data: {
          organizationId,
          createdById: session.sub,
          title: body.title,
          description: body.description,
          kind: body.kind,
          status: "ACTIVE",
          disableEntry,
          showBanner: body.showBanner,
          audience: body.audience,
          startsAt,
          endsAt,
          ...(blockIds.length > 0
            ? { blocks: { create: blockIds.map((blockId) => ({ blockId })) } }
            : {}),
        },
        include: EVENT_BLOCKS_INCLUDE,
      });

      let notifiedCount = 0;
      if (body.notify) {
        const recipientIds = await resolveAudienceUserIds(
          tx,
          organizationId,
          body.audience,
          blockIds
        );
        if (recipientIds.length > 0) {
          const message = buildEventNotificationMessage({
            description: body.description,
            blockNames,
            disableEntry,
            startsAt,
            endsAt,
            now,
          });
          await tx.notification.createMany({
            data: recipientIds.map((userId) => ({
              organizationId,
              userId,
              eventId: created.id,
              kind: body.kind,
              title: body.title,
              message,
            })),
          });
          notifiedCount = recipientIds.length;
        }
      }

      await tx.auditLog.create({
        data: auditData({
          organizationId,
          actor: session,
          action: "CREATE",
          entity: "EVENT",
          entityId: created.id,
          detail: {
            title: created.title,
            kind: created.kind,
            blocks: blockNames,
            disableEntry,
            notified: notifiedCount,
          },
        }),
      });

      return { created, notifiedCount };
    });

    return NextResponse.json(
      {
        event: {
          ...result.created,
          phase: eventPhase(result.created, now),
          blocks: eventBlocksView(result.created.blocks),
          notifiedCount: result.notifiedCount,
        },
        notifiedCount: result.notifiedCount,
      },
      { status: 201 }
    );
  },
  { roles: ["ADMIN"] }
);
