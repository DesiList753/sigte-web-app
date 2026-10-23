import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", async () => {
  const { mockPrismaWithAudit } = await import("@/test/prisma");
  return {
    prisma: mockPrismaWithAudit({
      organization: { findUnique: vi.fn().mockResolvedValue({ defaultBlockId: "default-a" }) },
      parkingBlock: {
        findFirst: vi.fn(),
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "block-a", ...data })),
        delete: vi.fn().mockResolvedValue({}),
      },
      vehicle: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    }),
  };
});

import { prisma } from "@/lib/prisma";
import { DELETE, PATCH } from "./route";
import { ORG_A, ORG_B, auditedIn, onlyInOrg, params, tenantRequest } from "@/test/tenant";

const blockA = { id: "block-a", name: "A", capacity: 10, organizationId: ORG_A, defaultOf: null };

async function patch(id: string, body: Record<string, unknown>, organizationId = ORG_A) {
  const req = await tenantRequest(`/api/parking/${id}`, { role: "ADMIN", organizationId }, { method: "PATCH", body });
  return PATCH(req, params({ id }));
}

async function remove(id: string, organizationId = ORG_A) {
  const req = await tenantRequest(`/api/parking/${id}`, { role: "ADMIN", organizationId }, { method: "DELETE" });
  return DELETE(req, params({ id }));
}

describe("PATCH /api/parking/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.parkingBlock.findFirst).mockImplementation(onlyInOrg(ORG_A, blockA));
  });

  it("un ADMIN de otra organización no puede editar el bloque", async () => {
    const res = await patch("block-a", { capacity: 99 }, ORG_B);
    expect(res.status).toBe(404);
    expect(prisma.parkingBlock.update).not.toHaveBeenCalled();
  });

  it("marcarlo por defecto lo conecta a su organización", async () => {
    const res = await patch("block-a", { isDefault: true });
    expect(res.status).toBe(200);
    expect(prisma.parkingBlock.update).toHaveBeenCalledWith({
      where: { id: "block-a" },
      data: { defaultOf: { connect: { id: ORG_A } } },
    });
  });

  it("no deja a la organización sin bloque por defecto", async () => {
    vi.mocked(prisma.parkingBlock.findFirst).mockResolvedValue({ ...blockA, defaultOf: { id: ORG_A } } as never);
    const res = await patch("block-a", { isDefault: false });
    expect(res.status).toBe(400);
    expect(prisma.parkingBlock.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/parking/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.parkingBlock.findFirst).mockImplementation(onlyInOrg(ORG_A, blockA));
  });

  it("un ADMIN de otra organización no puede borrar el bloque", async () => {
    const res = await remove("block-a", ORG_B);
    expect(res.status).toBe(404);
    expect(prisma.parkingBlock.delete).not.toHaveBeenCalled();
  });

  it("no permite borrar el bloque por defecto", async () => {
    vi.mocked(prisma.parkingBlock.findFirst).mockResolvedValue({ ...blockA, id: "default-a" } as never);
    const res = await remove("default-a");
    expect(res.status).toBe(400);
    expect(prisma.parkingBlock.delete).not.toHaveBeenCalled();
  });

  it("mueve los vehículos al bloque por defecto de la misma organización", async () => {
    const res = await remove("block-a");
    expect(res.status).toBe(200);
    expect(prisma.vehicle.updateMany).toHaveBeenCalledWith({
      where: { organizationId: ORG_A, currentBlockId: "block-a" },
      data: { currentBlockId: "default-a" },
    });
    expect(prisma.parkingBlock.delete).toHaveBeenCalledWith({ where: { id: "block-a" } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(auditedIn(ORG_A, "DELETE", "PARKING_BLOCK"));
  });
});
