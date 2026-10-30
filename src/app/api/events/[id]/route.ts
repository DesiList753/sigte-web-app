import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson, withTenant } from "@/lib/api";
import { auditData } from "@/lib/audit";
import { EVENT_BLOCKS_INCLUDE, eventBlocksView, eventPhase, resolveAudienceUserIds } from "@/lib/events";

const updateEventSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(3).max(1000).optional(),
  kind: z.enum(["EVENT", "EMERGENCY", "MAINTENANCE", "NOTICE"]).optional(),
  status: z.enum(["ACTIVE", "ENDED", "CANCELLED"]).optional(),
  blockIds: z.array(z.string().min(1)).optional(),
  disableEntry: z.boolean().optional(),
  showBanner: z.boolean().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  audience: z.enum(["ALL", "USERS", "GUARDS", "AFFECTED_VEHICLES"]).optional(),
  notifyUpdate: z.boolean().optional(),
  updateMessage: z.string().trim().max(500).optional(),
});

export const PATCH = withTenant<{ id: string }>(
  async (req, { session, params }) => {
    const parsed = await parseJson(req, updateEventSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const organizationId = session.organizationId;

    const target = await prisma.parkingEvent.findFirst({
      where: { id: params.id, organizationId },
      include: EVENT_BLOCKS_INCLUDE,
    });
    if (!target) return jsonError(404, "Evento no encontrado");

    const nextStartsAt = body.startsAt ? new Date(body.startsAt) : target.startsAt;
    const nextEndsAt =
      body.endsAt !== undefined ? (body.endsAt ? new Date(body.endsAt) : null) : target.endsAt;

    if (nextEndsAt && nextEndsAt.getTime() <= nextStartsAt.getTime()) {
      return jsonError(400, "La fecha de término debe ser posterior a la de inicio");
    }

    let nextBlockIds = target.blocks.map((b) => b.block.id);
    if (body.blockIds !== undefined) {
      nextBlockIds = Array.from(new Set(body.blockIds));
      if (nextBlockIds.length > 0) {
        const blocks = await prisma.parkingBlock.findMany({
          where: { organizationId, id: { in: nextBlockIds } },
          select: { id: true },
        });
        if (blocks.length !== nextBlockIds.length) {
          return jsonError(404, "Uno o más bloques seleccionados no existen en tu organización");
        }
      }
    }

    const nextAudience = body.audience ?? target.audience;
    if (nextAudience === "AFFECTED_VEHICLES" && nextBlockIds.length === 0) {
      return jsonError(400, "Selecciona al menos un bloque para notificar a vehículos afectados");
    }

    const nextDisableEntry =
      nextBlockIds.length === 0 ? false : (body.disableEntry ?? target.disableEntry);
    const nextStatus = body.status ?? target.status;
    const now = new Date();
    const endedAt =
      body.status === "ENDED" || body.status === "CANCELLED"
        ? now
        : body.status === "ACTIVE"
        ? null
        : target.endedAt;

    const updated = await prisma.$transaction(async (tx) => {
      const currentBlockIds = target.blocks.map((b) => b.block.id);
      const addedBlockIds = nextBlockIds.filter((id) => !currentBlockIds.includes(id));
      if (body.blockIds !== undefined) {
        await tx.parkingEventBlock.deleteMany({
          where: { eventId: target.id, blockId: { notIn: nextBlockIds } },
        });
      }

      const ev = await tx.parkingEvent.update({
        where: { id: target.id },
        data: {
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.kind !== undefined ? { kind: body.kind } : {}),
          ...(body.status !== undefined ? { status: body.status, endedAt } : {}),
          ...(body.showBanner !== undefined ? { showBanner: body.showBanner } : {}),
          ...(body.audience !== undefined ? { audience: body.audience } : {}),
          ...(body.startsAt !== undefined ? { startsAt: nextStartsAt } : {}),
          ...(body.endsAt !== undefined ? { endsAt: nextEndsAt } : {}),
          disableEntry: nextDisableEntry,
          ...(addedBlockIds.length > 0
            ? { blocks: { create: addedBlockIds.map((blockId) => ({ blockId })) } }
            : {}),
        },
        include: EVENT_BLOCKS_INCLUDE,
      });

      let notifiedCount = 0;
      if (body.notifyUpdate) {
        const recipientIds = await resolveAudienceUserIds(
          tx,
          organizationId,
          nextAudience,
          nextBlockIds
        );
        if (recipientIds.length > 0) {
          const closedNames = ev.blocks.filter((b) => !b.releasedAt).map((b) => b.block.name);
          const defaultMsg =
            nextStatus === "ENDED"
              ? ev.disableEntry && closedNames.length > 0
                ? `Finalizó el evento "${ev.title}". Ingreso nuevamente habilitado en: ${closedNames.join(", ")}.`
                : `Finalizó el evento "${ev.title}".`
              : nextStatus === "CANCELLED"
              ? `Se canceló el evento "${ev.title}".`
              : ev.description;

          const notifTitle =
            nextStatus === "ENDED"
              ? `Evento finalizado: ${ev.title}`
              : nextStatus === "CANCELLED"
              ? `Evento cancelado: ${ev.title}`
              : `Actualización: ${ev.title}`;

          await tx.notification.createMany({
            data: recipientIds.map((userId) => ({
              organizationId,
              userId,
              eventId: ev.id,
              kind: nextStatus === "ENDED" || nextStatus === "CANCELLED" ? "NOTICE" : ev.kind,
              title: notifTitle,
              message: body.updateMessage || defaultMsg,
            })),
          });
          notifiedCount = recipientIds.length;
        }
      }

      const auditAction =
        body.status && (body.status === "ENDED" || body.status === "CANCELLED")
          ? "RESOLVE"
          : "UPDATE";

      await tx.auditLog.create({
        data: auditData({
          organizationId,
          actor: session,
          action: auditAction,
          entity: "EVENT",
          entityId: ev.id,
          detail: {
            title: ev.title,
            status: ev.status,
            ...(notifiedCount > 0 ? { notified: notifiedCount } : {}),
          },
        }),
      });

      return { ev, notifiedCount };
    });

    return NextResponse.json({
      event: {
        ...updated.ev,
        phase: eventPhase(updated.ev, now),
        blocks: eventBlocksView(updated.ev.blocks),
      },
      notifiedCount: updated.notifiedCount,
    });
  },
  { roles: ["ADMIN"] }
);

export const DELETE = withTenant<{ id: string }>(
  async (_req, { session, params }) => {
    const organizationId = session.organizationId;
    const target = await prisma.parkingEvent.findFirst({
      where: { id: params.id, organizationId },
    });
    if (!target) return jsonError(404, "Evento no encontrado");

    await prisma.$transaction([
      prisma.parkingEvent.delete({ where: { id: target.id } }),
      prisma.auditLog.create({
        data: auditData({
          organizationId,
          actor: session,
          action: "DELETE",
          entity: "EVENT",
          entityId: target.id,
          detail: { title: target.title, kind: target.kind },
        }),
      }),
    ]);

    return NextResponse.json({ ok: true });
  },
  { roles: ["ADMIN"] }
);
