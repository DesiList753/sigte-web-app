import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "new-vehicle", ...data })),
    },
    user: { findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";
import { ORG_A, ORG_B, onlyInOrg, params, scopedTo, tenantRequest } from "@/test/tenant";

async function post(role: "USER" | "ADMIN", body: Record<string, unknown>, sub?: string) {
  const req = await tenantRequest("/api/vehicles", { role, sub }, { method: "POST", body });
  return POST(req, params({}));
}

describe("GET /api/vehicles", () => {
  beforeEach(() => vi.clearAllMocks());

  it("solo lista vehículos de la organización de la sesión", async () => {
    await GET(await tenantRequest("/api/vehicles?inside=true", { role: "GUARD" }), params({}));
    expect(prisma.vehicle.findMany).toHaveBeenCalledWith(scopedTo(ORG_A));
  });

  it("a un USER lo limita a sus vehículos", async () => {
    await GET(await tenantRequest("/api/vehicles", { role: "USER", sub: "user-a" }), params({}));
    expect(prisma.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG_A, ownerId: "user-a" } })
    );
  });
});

describe("POST /api/vehicles", () => {
  beforeEach(() => vi.clearAllMocks());

  it("crea el vehículo en la organización de la sesión", async () => {
    const res = await post("USER", { plate: "ab 1234" }, "user-a");
    expect(res.status).toBe(201);
    expect(prisma.vehicle.findUnique).toHaveBeenCalledWith({
      where: { organizationId_plate: { organizationId: ORG_A, plate: "AB1234" } },
    });
    expect(prisma.vehicle.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ organizationId: ORG_A, ownerId: "user-a" }) })
    );
  });

  it("un ADMIN no puede asignar un dueño de otra organización", async () => {
    vi.mocked(prisma.user.findFirst).mockImplementation(onlyInOrg(ORG_B, { id: "user-b" }));
    const res = await post("ADMIN", { plate: "AB1234", ownerId: "user-b" });
    expect(res.status).toBe(404);
    expect(prisma.vehicle.create).not.toHaveBeenCalled();
  });

  it("un USER no puede autorizar su vehículo al crearlo", async () => {
    await post("USER", { plate: "AB1234", authorized: false }, "user-a");
    expect(prisma.vehicle.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ authorized: undefined }) })
    );
  });
});
