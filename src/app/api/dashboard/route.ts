import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/api";
import { limitUsage } from "@/lib/plan";
import { dayKey, hourOf, startOfDay } from "@/lib/time";

export const GET = withTenant(async (_req, { session }) => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const last7 = new Date(now.getTime() - 7 * 86400_000);
  const organizationId = session.organizationId;
  const reports = session.plan.features.includes("REPORTS");

  if (session.role === "USER") {
    const [vehicles, accessToday, openInfractions, unreadNotifs] = await Promise.all([
      prisma.vehicle.count({ where: { organizationId, ownerId: session.sub } }),
      prisma.accessLog.count({
        where: { organizationId, vehicle: { ownerId: session.sub }, timestamp: { gte: todayStart } },
      }),
      prisma.infraction.count({ where: { organizationId, userId: session.sub, status: "OPEN" } }),
      prisma.notification.count({ where: { userId: session.sub, read: false } }),
    ]);
    return NextResponse.json({
      scope: "user",
      metrics: { vehicles, accessToday, openInfractions, unreadNotifs },
    });
  }

  const [
    totalUsers,
    totalGuards,
    totalAdmins,
    totalVehicles,
    authorizedVehicles,
    totalBlocks,
    totalAccessLogs,
    accessToday,
    currentInside,
    openInfractions,
    infractionsLast7,
    recentLogs,
    blocks,
    topVehiclesRaw,
  ] = await Promise.all([
    prisma.membership.count({ where: { organizationId, role: "USER" } }),
    prisma.membership.count({ where: { organizationId, role: "GUARD" } }),
    prisma.membership.count({ where: { organizationId, role: "ADMIN" } }),
    prisma.vehicle.count({ where: { organizationId } }),
    prisma.vehicle.count({ where: { organizationId, authorized: true } }),
    prisma.parkingBlock.count({ where: { organizationId } }),
    prisma.accessLog.count({ where: { organizationId } }),
    prisma.accessLog.count({ where: { organizationId, timestamp: { gte: todayStart } } }),
    prisma.vehicle.count({ where: { organizationId, currentBlockId: { not: null } } }),
    prisma.infraction.count({ where: { organizationId, status: "OPEN" } }),
    prisma.infraction.count({ where: { organizationId, createdAt: { gte: last7 } } }),
    prisma.accessLog.findMany({
      where: { organizationId, timestamp: { gte: last7 } },
      select: { timestamp: true, direction: true, method: true, authorized: true },
    }),
    prisma.parkingBlock.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      include: { _count: { select: { vehicles: true } } },
    }),
    reports
      ? prisma.accessLog.groupBy({
          by: ["vehicleId"],
          where: { organizationId, timestamp: { gte: last7 }, direction: "IN" },
          _count: { vehicleId: true },
          orderBy: { _count: { vehicleId: "desc" } },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  const byDay: Record<string, { in: number; out: number }> = {};
  for (let i = 6; i >= 0; i--) {
    byDay[dayKey(new Date(now.getTime() - i * 86400_000))] = { in: 0, out: 0 };
  }
  const methodDist: Record<string, number> = { PLATE: 0, QR: 0, CARD: 0, MANUAL: 0 };
  const byHour: Record<number, number> = {};
  let authorizedLast7 = 0;

  for (const l of recentLogs) {
    const day = byDay[dayKey(l.timestamp)];
    if (day) {
      if (l.direction === "IN") day.in++;
      else day.out++;
    }
    methodDist[l.method] = (methodDist[l.method] ?? 0) + 1;
    if (l.direction === "IN") {
      const h = hourOf(l.timestamp);
      byHour[h] = (byHour[h] ?? 0) + 1;
    }
    if (l.authorized) authorizedLast7++;
  }

  const series = Object.entries(byDay).map(([date, v]) => ({ date, ...v }));
  const peakHour = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const avgDailyAccess = Math.round(series.reduce((s, d) => s + d.in + d.out, 0) / 7);
  const authRate = recentLogs.length > 0 ? Math.round((authorizedLast7 / recentLogs.length) * 100) : 100;

  const occupancy = blocks.map((b) => ({
    id: b.id,
    name: b.name,
    capacity: b.capacity,
    occupied: b._count.vehicles,
    percentage: Math.round((b._count.vehicles / b.capacity) * 100),
  }));

  const topRows = topVehiclesRaw.length
    ? await prisma.vehicle.findMany({
        where: { organizationId, id: { in: topVehiclesRaw.map((r) => r.vehicleId) } },
        select: { id: true, plate: true, owner: { select: { name: true } } },
      })
    : [];
  const topById = new Map(topRows.map((v) => [v.id, v]));
  const topVehicles = topVehiclesRaw.map((row) => {
    const v = topById.get(row.vehicleId);
    return { plate: v?.plate ?? "?", owner: v?.owner?.name ?? "—", count: row._count.vehicleId };
  });

  const plan =
    session.role === "ADMIN"
      ? {
          name: session.plan.name,
          features: session.plan.features,
          limits: await limitUsage(organizationId, session.plan),
        }
      : undefined;

  return NextResponse.json({
    scope: session.role.toLowerCase(),
    plan,
    metrics: {
      totalUsers,
      totalGuards,
      totalAdmins,
      totalVehicles,
      authorizedVehicles,
      totalBlocks,
      totalAccessLogs,
      accessToday,
      currentInside,
      openInfractions,
      infractionsLast7,
      avgDailyAccess,
      authRate,
      peakHour: peakHour !== null ? `${String(peakHour).padStart(2, "0")}:00` : null,
    },
    series: reports ? series : [],
    occupancy,
    topVehicles,
    methodDist: reports ? methodDist : {},
  });
});
