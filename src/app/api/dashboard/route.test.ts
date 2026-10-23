import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    membership: { count: vi.fn().mockResolvedValue(0) },
    vehicle: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    parkingBlock: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    accessLog: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    infraction: { count: vi.fn().mockResolvedValue(0) },
    notification: { count: vi.fn().mockResolvedValue(0) },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";
import { ORG_A, params, tenantRequest } from "@/test/tenant";

function allCalls() {
  return [
    prisma.membership.count,
    prisma.vehicle.count,
    prisma.vehicle.findMany,
    prisma.parkingBlock.count,
    prisma.parkingBlock.findMany,
    prisma.accessLog.count,
    prisma.accessLog.findMany,
    prisma.accessLog.groupBy,
    prisma.infraction.count,
  ].flatMap((fn) => vi.mocked(fn).mock.calls.map((call) => call[0] as { where?: { organizationId?: string } }));
}

describe("GET /api/dashboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("todas las métricas de admin cuentan solo su organización", async () => {
    const res = await GET(await tenantRequest("/api/dashboard", { role: "ADMIN" }), params({}));
    expect(res.status).toBe(200);
    const calls = allCalls();
    expect(calls.length).toBeGreaterThan(10);
    for (const args of calls) expect(args.where?.organizationId).toBe(ORG_A);
  });

  it("las métricas de un USER se limitan a sus datos y su organización", async () => {
    const res = await GET(await tenantRequest("/api/dashboard", { role: "USER", sub: "user-a" }), params({}));
    expect((await res.json()).scope).toBe("user");
    expect(prisma.vehicle.count).toHaveBeenCalledWith({ where: { organizationId: ORG_A, ownerId: "user-a" } });
    expect(prisma.infraction.count).toHaveBeenCalledWith({
      where: { organizationId: ORG_A, userId: "user-a", status: "OPEN" },
    });
  });

  it("sin reportes en el plan no entrega datos de gráficos", async () => {
    const req = await tenantRequest("/api/dashboard", {
      role: "ADMIN",
      plan: { name: "Profesional", features: ["QR", "INFRACTIONS"] },
    });
    const body = await (await GET(req, params({}))).json();
    expect(body.series).toEqual([]);
    expect(body.methodDist).toEqual({});
    expect(prisma.accessLog.groupBy).not.toHaveBeenCalled();
  });

  it("al ADMIN le muestra el uso de su plan", async () => {
    const req = await tenantRequest("/api/dashboard", { role: "ADMIN", plan: { name: "Básico", maxGuards: 2 } });
    const body = await (await GET(req, params({}))).json();
    expect(body.plan.name).toBe("Básico");
    expect(body.plan.limits.guards).toEqual({ used: 0, max: 2 });
  });

  it("agrupa los accesos por día y hora de Chile", async () => {
    const at = new Date();
    at.setUTCHours(2, 30, 0, 0);
    vi.mocked(prisma.accessLog.findMany).mockResolvedValue([
      { timestamp: at, direction: "IN", method: "QR", authorized: true },
    ] as never);
    const res = await GET(await tenantRequest("/api/dashboard", { role: "ADMIN" }), params({}));
    const body = await res.json();
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Santiago", hour: "numeric", hourCycle: "h23" }).format(at));
    expect(body.metrics.peakHour).toBe(`${String(hour).padStart(2, "0")}:00`);
    expect(body.methodDist.QR).toBe(1);
  });
});
