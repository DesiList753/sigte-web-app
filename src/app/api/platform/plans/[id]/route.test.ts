import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", async () => {
  const { mockPrismaWithAudit } = await import("@/test/prisma");
  return {
    prisma: mockPrismaWithAudit({
      plan: {
        findUnique: vi.fn(),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "plan_basico", name: "Básico", ...data })),
      },
    }),
  };
});

import { prisma } from "@/lib/prisma";
import { PATCH } from "./route";
import { params, platformRequest, tenantRequest } from "@/test/tenant";

const basico = {
  id: "plan_basico",
  code: "basico",
  name: "Básico",
  maxUsers: 100,
  maxGuards: 2,
  maxBlocks: 3,
  maxVehicles: 150,
  features: ["QR"],
};

async function patch(body: Record<string, unknown>) {
  return PATCH(await platformRequest("/api/platform/plans/plan_basico", { method: "PATCH", body }), params({ id: "plan_basico" }));
}

describe("PATCH /api/platform/plans/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.plan.findUnique).mockResolvedValue(basico as never);
  });

  it("edita límites y funciones y registra qué cambió", async () => {
    const res = await patch({ maxGuards: 5, maxUsers: 100, features: ["QR", "INFRACTIONS", "QR"] });
    expect(res.status).toBe(200);
    expect(prisma.plan.update).toHaveBeenCalledWith({
      where: { id: "plan_basico" },
      data: { maxGuards: 5, maxUsers: 100, features: ["QR", "INFRACTIONS"] },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: null,
        action: "UPDATE",
        entity: "PLAN",
        detail: { name: "Básico", fields: ["maxGuards", "features"] },
      }),
    });
  });

  it("permite dejar un límite sin tope", async () => {
    await patch({ maxVehicles: null });
    expect(prisma.plan.update).toHaveBeenCalledWith({ where: { id: "plan_basico" }, data: { maxVehicles: null } });
  });

  it("rechaza un límite menor que 1", async () => {
    const res = await patch({ maxGuards: 0 });
    expect(res.status).toBe(400);
    expect(prisma.plan.update).not.toHaveBeenCalled();
  });

  it("responde 404 si el plan no existe", async () => {
    vi.mocked(prisma.plan.findUnique).mockResolvedValueOnce(null);
    const res = await patch({ name: "Otro" });
    expect(res.status).toBe(404);
  });

  it("un ADMIN de organización no puede editar planes", async () => {
    const res = await PATCH(
      await tenantRequest("/api/platform/plans/plan_basico", { role: "ADMIN" }, { method: "PATCH", body: { maxUsers: 9999 } }),
      params({ id: "plan_basico" })
    );
    expect(res.status).toBe(403);
    expect(prisma.plan.update).not.toHaveBeenCalled();
  });
});
