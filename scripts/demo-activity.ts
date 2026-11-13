import { writeFileSync } from "node:fs";
import type { AccessMethod, Prisma } from "@prisma/client";
import { loadBlockingEventsByBlock } from "../src/lib/events";
import { prisma } from "../src/lib/prisma";
import { dayKey, startOfDay } from "../src/lib/time";

const DAYS = 7;
const METHODS: AccessMethod[] = ["PLATE", "PLATE", "PLATE", "QR", "QR", "CARD", "MANUAL"];
const HOUR = 3600_000;
const MINUTE = 60_000;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function at(dayStart: Date, hour: number, minute: number) {
  return new Date(dayStart.getTime() + hour * HOUR + minute * MINUTE);
}

async function main() {
  const args = process.argv.slice(2);
  const slug = args.find((a) => !a.startsWith("--"));
  const apply = args.includes("--apply");
  if (!slug) throw new Error("Uso: tsx scripts/demo-activity.ts <slug> [--apply]");

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, displayName: true, defaultBlockId: true, plan: { select: { name: true, features: true } } },
  });
  if (!org) throw new Error(`No existe la organización "${slug}".`);
  const organizationId = org.id;

  const now = new Date();
  const today = startOfDay(now);
  const since = new Date(today.getTime() - DAYS * 24 * HOUR);

  const [members, vehicles, blocks, recentLogs, openInfractions, activeEvents, pendingMembers, pendingVehicles] =
    await Promise.all([
      prisma.membership.groupBy({ by: ["role"], where: { organizationId, status: "ACTIVE" }, _count: { role: true } }),
      prisma.vehicle.findMany({
        where: { organizationId, authorized: true, status: "APPROVED" },
        select: { id: true, plate: true, ownerId: true, currentBlockId: true },
      }),
      prisma.parkingBlock.findMany({
        where: { organizationId, active: true },
        select: { id: true, name: true, capacity: true, _count: { select: { vehicles: true } } },
      }),
      prisma.accessLog.findMany({
        where: { organizationId, timestamp: { gte: since } },
        select: { vehicleId: true, timestamp: true },
      }),
      prisma.infraction.count({ where: { organizationId, status: "OPEN" } }),
      prisma.parkingEvent.count({ where: { organizationId, status: "ACTIVE", endedAt: null } }),
      prisma.membership.count({ where: { organizationId, status: "PENDING" } }),
      prisma.vehicle.count({ where: { organizationId, status: "PENDING" } }),
    ]);
  const guards = await prisma.membership.findMany({
    where: { organizationId, status: "ACTIVE", role: "GUARD" },
    select: { userId: true },
  });

  const perDay: Record<string, number> = {};
  const seenToday = new Set<string>();
  for (const l of recentLogs) {
    const key = dayKey(l.timestamp);
    perDay[key] = (perDay[key] ?? 0) + 1;
    if (l.timestamp >= today) seenToday.add(l.vehicleId);
  }

  console.log(`${org.displayName} (${slug}) · plan ${org.plan.name} [${org.plan.features.join(", ")}]`);
  console.log(`Miembros activos: ${members.map((m) => `${m.role} ${m._count.role}`).join(" | ") || "ninguno"}`);
  console.log(`Vehículos aprobados: ${vehicles.length} · dentro ahora: ${vehicles.filter((v) => v.currentBlockId).length}`);
  console.log(`Bloques activos: ${blocks.map((b) => `${b.name} ${b._count.vehicles}/${b.capacity}`).join(" | ")}`);
  console.log(`Infracciones abiertas: ${openInfractions} · eventos activos: ${activeEvents}`);
  console.log(`Solicitudes pendientes: ${pendingMembers} de ingreso, ${pendingVehicles} de vehículos`);
  for (let d = DAYS; d >= 0; d--) {
    const key = dayKey(new Date(today.getTime() - d * 24 * HOUR + 12 * HOUR));
    console.log(`  ${key}: ${perDay[key] ?? 0} accesos`);
  }

  if (vehicles.length === 0 || guards.length === 0) {
    console.log("Sin vehículos aprobados o sin guardias: no hay nada que generar.");
    return;
  }

  const closed = await loadBlockingEventsByBlock(organizationId, now);
  const parking = blocks.filter((b) => b.id !== org.defaultBlockId && !closed.has(b.id));
  const free = new Map(parking.map((b) => [b.id, b.capacity - b._count.vehicles]));
  const fallbackBlockId = org.defaultBlockId ?? blocks[0]?.id ?? null;
  const logs: Prisma.AccessLogCreateManyInput[] = [];
  const entries: { vehicleId: string; blockId: string }[] = [];
  const push = (v: (typeof vehicles)[number], direction: "IN" | "OUT", timestamp: Date, blockId: string | null) =>
    logs.push({
      organizationId,
      vehicleId: v.id,
      userId: v.ownerId,
      guardId: pick(guards).userId,
      blockId,
      method: pick(METHODS),
      direction,
      timestamp,
      authorized: true,
    });

  for (let d = DAYS; d >= 1; d--) {
    const dayStart = new Date(today.getTime() - d * 24 * HOUR);
    const key = dayKey(new Date(dayStart.getTime() + 12 * HOUR));
    if ((perDay[key] ?? 0) > 0) continue;
    for (const v of vehicles) {
      if (Math.random() > 0.9) continue;
      const blockId = v.currentBlockId ?? pick(parking)?.id ?? fallbackBlockId;
      push(v, "IN", at(dayStart, pick([7, 8, 8, 9]), pick([0, 10, 15, 20, 25, 30, 35, 40, 45, 50])), blockId);
      push(v, "OUT", at(dayStart, pick([16, 17, 17, 18, 18, 19]), pick([0, 10, 15, 20, 30, 40, 45, 50])), blockId);
    }
  }

  const elapsed = now.getTime() - today.getTime() - 7 * HOUR;
  if (elapsed > 0) {
    for (const v of vehicles) {
      if (seenToday.has(v.id) || Math.random() > 0.75) continue;
      let blockId = v.currentBlockId;
      if (blockId && closed.has(blockId)) continue;
      if (!blockId) {
        const open = parking.filter((b) => (free.get(b.id) ?? 0) > 0);
        if (open.length === 0) continue;
        blockId = pick(open).id;
        free.set(blockId, (free.get(blockId) ?? 0) - 1);
        entries.push({ vehicleId: v.id, blockId });
      }
      push(v, "IN", new Date(today.getTime() + 7 * HOUR + Math.floor(Math.random() * elapsed)), blockId);
    }
  }

  console.log(`A generar: ${logs.length} accesos · ${entries.length} vehículos pasan a estar dentro`);
  if (!apply) {
    console.log("Simulación: no se escribió nada. Agrega --apply para guardar.");
    return;
  }
  if (logs.length === 0) return;

  const created = await prisma.$transaction(async (tx) => {
    const rows = await tx.accessLog.createManyAndReturn({ data: logs, select: { id: true } });
    for (const e of entries) {
      await tx.vehicle.update({ where: { id: e.vehicleId }, data: { currentBlockId: e.blockId } });
    }
    return rows;
  });
  const record = `demo-activity-${slug}-${now.getTime()}.json`;
  writeFileSync(record, JSON.stringify({ slug, accessLogIds: created.map((r) => r.id), entries }, null, 2));
  console.log(`Guardado: ${created.length} accesos. Registro para deshacer: ${record}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
