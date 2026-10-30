import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson, withTenant } from "@/lib/api";
import { auditData } from "@/lib/audit";
import { EVENT_BLOCKS_INCLUDE, eventBlocksView, eventPhase, resolveAudienceUserIds } from "@/lib/events";

const blockStateSchema = z.object({
  released: z.boolean(),
  notify: z.boolean().default(false),
});

export const PATCH = withTenant<{ id: string; blockId: string }>(
  async (req, { session, params }) => {
    const parsed = await parseJson(req, blockStateSchema);
    if (!parsed.ok) return parsed.response;
    const { released, notify } = parsed.data;
    const organizationId = session.organizationId;

    const event = await prisma.parkingEvent.findFirst({
      where: { id: params.id, organizationId },
      include: EVENT_BLOCKS_INCLUDE,
    });
    if (!event) return jsonError(404, "Evento no encontrado");

    const link = event.blocks.find((b) => b.block.id === params.blockId);
    if (!link) return jsonError(404, "El bloque no pertenece a este evento");

    const now = new Date();
    const phase = eventPhase(event, now);
    if (phase === "ENDED" || phase === "CANCELLED") {
      return jsonError(409, "El evento ya no está vigente");
    }

    if ((link.releasedAt !== null) === released) {
      return NextResponse.json({ event: { id: event.id, blocks: eventBlocksView(event.blocks) }, notifiedCount: 0 });
    }

    const blockName = link.block.name;
    const result = await prisma.$transaction(async (tx) => {
      await tx.parkingEventBlock.update({
        where: { eventId_blockId: { eventId: event.id, blockId: link.block.id } },
        data: { releasedAt: released ? now : null },
      });

      let notifiedCount = 0;
      if (notify) {
        const recipientIds = await resolveAudienceUserIds(tx, organizationId, event.audience, [link.block.id]);
        if (recipientIds.length > 0) {
          await tx.notification.createMany({
            data: recipientIds.map((userId) => ({
              organizationId,
              userId,
              eventId: event.id,
              kind: released ? "NOTICE" : event.kind,
              title: released ? `Ingreso habilitado: ${blockName}` : `Ingreso cerrado: ${blockName}`,
              message: released
                ? `Se habilitó nuevamente el ingreso a ${blockName}. El evento "${event.title}" sigue en curso.`
                : `Se cerró el ingreso a ${blockName} por el evento "${event.title}".`,
            })),
          });
          notifiedCount = recipientIds.length;
        }
      }

      await tx.auditLog.create({
        data: auditData({
          organizationId,
          actor: session,
          action: released ? "REACTIVATE" : "SUSPEND",
          entity: "EVENT",
          entityId: event.id,
          detail: {
            title: event.title,
            blocks: [blockName],
            ...(notifiedCount > 0 ? { notified: notifiedCount } : {}),
          },
        }),
      });

      const blocks = await tx.parkingEventBlock.findMany({
        where: { eventId: event.id },
        include: { block: { select: { id: true, name: true } } },
      });
      return { blocks, notifiedCount };
    });

    return NextResponse.json({
      event: { id: event.id, blocks: eventBlocksView(result.blocks) },
      notifiedCount: result.notifiedCount,
    });
  },
  { roles: ["ADMIN"] }
);
