import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", async () => {
  const { mockPrismaWithAudit } = await import("@/test/prisma");
  return {
    prisma: mockPrismaWithAudit({
      organization: { findUnique: vi.fn().mockResolvedValue({ defaultBlockId: "default-a" }) },
      parkingBlock: {
        findMany: vi.fn().mockResolvedValue([
          { id: "block-a", name: "A", description: null, capacity: 10, _count: { vehicles: 2 } },
          { id: "default-a", name: "No definido", description: null, capacity: 50, _count: { vehicles: 1 } },
        ]),
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "new-block", ...data })),
      },
      vehicle: { count: vi.fn().mockResolvedValue(3) },
    }),
  };
});

import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";
import { ORG_A, auditedIn, params, scopedTo, tenantRequest } from "@/test/tenant";

async function post(body: Record<string, unknown>, role: "ADMIN" | "GUARD" = "ADMIN") {
  const req = await tenantRequest("/api/parking", { role }, { method: "POST", body });
  return POST(req, params({}));
}

describe("GET /api/parking", () => {
  beforeEach(() => vi.clearAllMocks());

  it("solo lista bloques y ocupación de la organización de la sesión", async () => {
    const res = await GET(await tenantRequest("/api/parking", { role: "GUARD" }), params({}));
    const body = await res.json();
    expect(prisma.parkingBlock.findMany).toHaveBeenCalledWith(scopedTo(ORG_A));
    expect(prisma.vehicle.count).toHaveBeenCalledWith(scopedTo(ORG_A));
    expect(prisma.organization.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ORG_A } }));
    expect(body.blocks[0]).toMatchObject({ id: "default-a", isDefault: true });
    expect(body.totals).toEqual({ inside: 3, capacity: 60, free: 57, defaultBlockId: "default-a" });
  });
});

describe("POST /api/parking", () => {
  beforeEach(() => vi.clearAllMocks());

  it("crea el bloque en la organización de la sesión", async () => {
    const res = await post({ name: "Nuevo", capacity: 20, organizationId: "org-b" });
    expect(res.status).toBe(201);
    expect(prisma.parkingBlock.create).toHaveBeenCalledWith({
      data: { name: "Nuevo", capacity: 20, organizationId: ORG_A },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(auditedIn(ORG_A, "CREATE", "PARKING_BLOCK"));
  });

  it("marcarlo por defecto lo asigna solo a su organización", async () => {
    await post({ name: "Nuevo", capacity: 20, isDefault: true });
    expect(prisma.parkingBlock.create).toHaveBeenCalledWith({
      data: { name: "Nuevo", capacity: 20, organizationId: ORG_A, defaultOf: { connect: { id: ORG_A } } },
    });
  });

  it("rechaza un nombre repetido dentro de la organización", async () => {
    vi.mocked(prisma.parkingBlock.findUnique).mockResolvedValueOnce({ id: "block-a" } as never);
    const res = await post({ name: "A", capacity: 20 });
    expect(res.status).toBe(409);
    expect(prisma.parkingBlock.findUnique).toHaveBeenCalledWith({
      where: { organizationId_name: { organizationId: ORG_A, name: "A" } },
    });
  });

  it("no crea bloques si el plan llegó al tope", async () => {
    vi.mocked(prisma.parkingBlock.count).mockResolvedValueOnce(3);
    const req = await tenantRequest(
      "/api/parking",
      { role: "ADMIN", plan: { name: "Básico", maxBlocks: 3 } },
      { method: "POST", body: { name: "Cuarto", capacity: 10 } }
    );
    const res = await POST(req, params({}));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("PLAN_LIMIT");
    expect(prisma.parkingBlock.create).not.toHaveBeenCalled();
  });

  it("solo un ADMIN puede crear bloques", async () => {
    const res = await post({ name: "Nuevo", capacity: 20 }, "GUARD");
    expect(res.status).toBe(403);
  });
});
