import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    infraction: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "inf-1" }),
    },
    vehicle: { findFirst: vi.fn(), findUnique: vi.fn() },
    notification: { create: vi.fn().mockResolvedValue({}) },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";
import { ORG_A, ORG_B, onlyInOrg, params, scopedTo, tenantRequest } from "@/test/tenant";

const vehicleB = { id: "vehicle-b", plate: "BB1111", ownerId: "user-b", organizationId: ORG_B };

async function post(body: Record<string, unknown>) {
  const req = await tenantRequest("/api/infractions", { role: "GUARD" }, { method: "POST", body });
  return POST(req, params({}));
}

describe("GET /api/infractions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("solo lista infracciones de la organización de la sesión", async () => {
    await GET(await tenantRequest("/api/infractions", { role: "ADMIN" }), params({}));
    expect(prisma.infraction.findMany).toHaveBeenCalledWith(scopedTo(ORG_A));
  });

  it("no muestra infracciones si el plan no las incluye", async () => {
    const req = await tenantRequest("/api/infractions", { role: "ADMIN", plan: { name: "Básico", features: ["QR"] } });
    const res = await GET(req, params({}));
    expect(res.status).toBe(403);
    expect(prisma.infraction.findMany).not.toHaveBeenCalled();
  });

  it("a un USER lo limita a sus infracciones", async () => {
    await GET(await tenantRequest("/api/infractions", { role: "USER", sub: "user-a" }), params({}));
    expect(prisma.infraction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG_A, userId: "user-a" } })
    );
  });
});

describe("POST /api/infractions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("no registra infracciones a vehículos de otra organización", async () => {
    vi.mocked(prisma.vehicle.findFirst).mockImplementation(onlyInOrg(ORG_B, vehicleB));
    const res = await post({ vehicleId: vehicleB.id, type: "OTHER", description: "Prueba" });
    expect(res.status).toBe(404);
    expect(prisma.infraction.create).not.toHaveBeenCalled();
  });

  it("busca la patente en su organización y guarda la organización", async () => {
    vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({ ...vehicleB, organizationId: ORG_A } as never);
    const res = await post({ plate: "bb1111", type: "OTHER", description: "Prueba" });
    expect(res.status).toBe(201);
    expect(prisma.vehicle.findUnique).toHaveBeenCalledWith({
      where: { organizationId_plate: { organizationId: ORG_A, plate: "BB1111" } },
    });
    expect(prisma.infraction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: ORG_A }),
    });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: ORG_A }),
    });
  });
});
