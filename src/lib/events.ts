import type { EventAudience, EventKind, EventStatus, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { formatDate } from "./utils";

export type EventPhase = "ACTIVE" | "SCHEDULED" | "ENDED" | "CANCELLED";

export type EventBlockView = { id: string; name: string; released: boolean };

export function eventBlocksView(
  blocks: { releasedAt: Date | null; block: { id: string; name: string } }[]
): EventBlockView[] {
  return blocks.map((b) => ({ id: b.block.id, name: b.block.name, released: b.releasedAt !== null }));
}

export const EVENT_BLOCKS_INCLUDE = {
  blocks: { include: { block: { select: { id: true, name: true } } } },
} satisfies Prisma.ParkingEventInclude;

export type BlockingEventSummary = {
  id: string;
  title: string;
  kind: EventKind;
  endsAt: string | null;
};

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  EVENT: "Evento",
  EMERGENCY: "Urgencia",
  MAINTENANCE: "Mantención",
  NOTICE: "Aviso",
};

export const EVENT_AUDIENCE_LABEL: Record<EventAudience, string> = {
  ALL: "Toda la organización",
  USERS: "Solo conductores",
  GUARDS: "Solo guardias",
  AFFECTED_VEHICLES: "Vehículos en bloques afectados",
};

export const EVENT_PHASE_LABEL: Record<EventPhase, string> = {
  ACTIVE: "En curso",
  SCHEDULED: "Programado",
  ENDED: "Finalizado",
  CANCELLED: "Cancelado",
};

const KIND_PRIORITY: Record<EventKind, number> = {
  EMERGENCY: 4,
  MAINTENANCE: 3,
  EVENT: 2,
  NOTICE: 1,
};

export function eventPhase(
  event: { status: EventStatus; startsAt: Date; endsAt: Date | null },
  now = new Date()
): EventPhase {
  if (event.status === "CANCELLED") return "CANCELLED";
  if (event.status === "ENDED") return "ENDED";
  if (event.endsAt && event.endsAt.getTime() <= now.getTime()) return "ENDED";
  if (event.startsAt.getTime() > now.getTime()) return "SCHEDULED";
  return "ACTIVE";
}

export function activeEventsWhere(
  organizationId: string,
  now = new Date()
): Prisma.ParkingEventWhereInput {
  return {
    organizationId,
    status: "ACTIVE",
    startsAt: { lte: now },
    OR: [{ endsAt: null }, { endsAt: { gt: now } }],
  };
}

export async function loadBlockingEventsByBlock(
  organizationId: string,
  now = new Date()
): Promise<Map<string, BlockingEventSummary>> {
  const map = new Map<string, BlockingEventSummary>();

  const events = await prisma.parkingEvent.findMany({
    where: {
      ...activeEventsWhere(organizationId, now),
      disableEntry: true,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      kind: true,
      endsAt: true,
      blocks: { where: { releasedAt: null }, select: { blockId: true } },
    },
  });

  for (const ev of events) {
    const summary: BlockingEventSummary = {
      id: ev.id,
      title: ev.title,
      kind: ev.kind,
      endsAt: ev.endsAt ? ev.endsAt.toISOString() : null,
    };
    for (const { blockId } of ev.blocks) {
      const prev = map.get(blockId);
      if (!prev || KIND_PRIORITY[summary.kind] > KIND_PRIORITY[prev.kind]) {
        map.set(blockId, summary);
      }
    }
  }
  return map;
}

export async function findBlockingEventForBlock(
  organizationId: string,
  blockId: string,
  now = new Date()
): Promise<BlockingEventSummary | null> {
  const ev = await prisma.parkingEvent.findFirst({
    where: {
      ...activeEventsWhere(organizationId, now),
      disableEntry: true,
      blocks: { some: { blockId, releasedAt: null } },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, kind: true, endsAt: true },
  });

  if (!ev) return null;
  return {
    id: ev.id,
    title: ev.title,
    kind: ev.kind,
    endsAt: ev.endsAt ? ev.endsAt.toISOString() : null,
  };
}

export async function resolveAudienceUserIds(
  db: Pick<typeof prisma, "membership" | "vehicle">,
  organizationId: string,
  audience: EventAudience,
  blockIds: string[]
): Promise<string[]> {
  if (audience === "AFFECTED_VEHICLES") {
    if (blockIds.length === 0) return [];
    const vehicles = await db.vehicle.findMany({
      where: { organizationId, currentBlockId: { in: blockIds } },
      select: { ownerId: true },
    });
    return Array.from(new Set(vehicles.map((v) => v.ownerId)));
  }

  const roleFilter: Prisma.MembershipWhereInput =
    audience === "USERS"
      ? { role: "USER" }
      : audience === "GUARDS"
      ? { role: "GUARD" }
      : {};

  const members = await db.membership.findMany({
    where: { organizationId, active: true, ...roleFilter },
    select: { userId: true },
  });
  return Array.from(new Set(members.map((m) => m.userId)));
}

export function buildEventNotificationMessage(opts: {
  description: string;
  blockNames: string[];
  disableEntry: boolean;
  startsAt: Date;
  endsAt: Date | null;
  now?: Date;
}): string {
  const parts = [opts.description.trim()];
  if (opts.blockNames.length > 0) {
    const label = opts.disableEntry ? "Ingreso cerrado en" : "Bloques involucrados";
    parts.push(`${label}: ${opts.blockNames.join(", ")}.`);
  }
  const now = opts.now ?? new Date();
  const isScheduled = opts.startsAt.getTime() > now.getTime() + 60_000;
  if (isScheduled && opts.endsAt) {
    parts.push(`Horario: ${formatDate(opts.startsAt)} — ${formatDate(opts.endsAt)}.`);
  } else if (isScheduled) {
    parts.push(`Desde: ${formatDate(opts.startsAt)}.`);
  } else if (opts.endsAt) {
    parts.push(`Vigente hasta: ${formatDate(opts.endsAt)}.`);
  }
  return parts.join(" ");
}
