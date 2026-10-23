import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: { findFirst: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    parkingBlock: { findFirst: vi.fn() },
    accessLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));

import { prisma } from "@/lib/prisma";
import { POST } from "./route";
import { ORG_A, ORG_B, onlyInOrg, params, tenantRequest } from "@/test/tenant";

const insideVehicle = {
  id: "vehicle-1",
  plate: "AB1234",
  ownerId: "user-1",
  authorized: true,
  organizationId: ORG_A,
  currentBlockId: "block-a",
  currentBlock: { id: "block-a", name: "A" },
};

async function move(blockId: string, organizationId = ORG_A) {
  const req = await tenantRequest(
    "/api/vehicles/vehicle-1/move",
    { role: "GUARD", organizationId },
    { method: "POST", body: { blockId } }
  );
  return POST(req, params({ id: "vehicle-1" }));
}

describe("POST /api/vehicles/[id]/move", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.vehicle.findFirst).mockImplementation(onlyInOrg(ORG_A, insideVehicle));
  });

  it("un guardia de otra organización no puede mover el vehículo", async () => {
    const res = await move("block-b", ORG_B);
    expect(res.status).toBe(404);
    expect(prisma.vehicle.update).not.toHaveBeenCalled();
  });

  it("no mueve el vehículo a un bloque de otra organización", async () => {
    vi.mocked(prisma.parkingBlock.findFirst).mockImplementation(onlyInOrg(ORG_B, { id: "block-b", name: "B" }));
    const res = await move("block-b");
    expect(res.status).toBe(404);
    expect(prisma.parkingBlock.findFirst).toHaveBeenCalledWith({ where: { id: "block-b", organizationId: ORG_A } });
    expect(prisma.vehicle.update).not.toHaveBeenCalled();
  });

  it("registra la reubicación con la organización de la sesión", async () => {
    vi.mocked(prisma.parkingBlock.findFirst).mockImplementation(onlyInOrg(ORG_A, { id: "block-c", name: "C" }));
    const res = await move("block-c");
    expect(res.status).toBe(200);
    expect(prisma.accessLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: ORG_A, blockId: "block-c" }),
    });
  });
});
