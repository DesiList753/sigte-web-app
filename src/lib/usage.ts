import { prisma } from "./prisma";
import { startOfMonth } from "./time";

export type Usage = {
  users: number;
  guards: number;
  admins: number;
  blocks: number;
  vehicles: number;
  accessesThisMonth: number;
};

const EMPTY: Usage = { users: 0, guards: 0, admins: 0, blocks: 0, vehicles: 0, accessesThisMonth: 0 };

export async function usageByOrganization(organizationId?: string) {
  const scope = organizationId ? { organizationId } : {};
  const [users, vehicles, blocks, accesses] = await Promise.all([
    prisma.membership.groupBy({
      by: ["organizationId", "role"],
      where: scope,
      _count: { _all: true },
    }),
    prisma.vehicle.groupBy({ by: ["organizationId"], where: scope, _count: { _all: true } }),
    prisma.parkingBlock.groupBy({ by: ["organizationId"], where: scope, _count: { _all: true } }),
    prisma.accessLog.groupBy({
      by: ["organizationId"],
      where: { ...scope, timestamp: { gte: startOfMonth(new Date()) } },
      _count: { _all: true },
    }),
  ]);

  const usage = new Map<string, Usage>();
  const get = (id: string) => {
    if (!usage.has(id)) usage.set(id, { ...EMPTY });
    return usage.get(id)!;
  };

  for (const row of users) {
    const u = get(row.organizationId);
    if (row.role === "USER") u.users = row._count._all;
    if (row.role === "GUARD") u.guards = row._count._all;
    if (row.role === "ADMIN") u.admins = row._count._all;
  }
  for (const row of vehicles) get(row.organizationId).vehicles = row._count._all;
  for (const row of blocks) get(row.organizationId).blocks = row._count._all;
  for (const row of accesses) get(row.organizationId).accessesThisMonth = row._count._all;

  return { get: (id: string) => usage.get(id) ?? { ...EMPTY } };
}
