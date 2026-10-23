import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", async () => {
  const { mockPrismaWithAudit } = await import("@/test/prisma");
  return {
    prisma: mockPrismaWithAudit({
      plan: {
        findMany: vi.fn().mockResolvedValue([{ id: "plan_basico", name: "Básico" }]),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "plan_new", ...data })),
      },
    }),
  };
});

import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";
import { params, platformRequest, tenantRequest } from "@/test/tenant";

const empresa = {
  code: "empresa",
  name: "Empresa",
  maxUsers: 300,
  maxGuards: 4,
  maxBlocks: null,
  maxVehicles: 500,
  features: ["QR", "REPORTS"],
};

describe("GET /api/platform/plans", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lista los planes para VanillaSoft", async () => {
    const res = await GET(await platformRequest("/api/platform/plans"), params({}));
    expect((await res.json()).plans).toHaveLength(1);
  });

  it("rechaza al ADMIN de una organización", async () => {
    const res = await GET(await tenantRequest("/api/platform/plans", { role: "ADMIN" }), params({}));
    expect(res.status).toBe(403);
    expect(prisma.plan.findMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/platform/plans", () => {
  beforeEach(() => vi.clearAllMocks());

  it("crea un plan y lo deja en la auditoría de plataforma", async () => {
    const res = await POST(await platformRequest("/api/platform/plans", { method: "POST", body: empresa }), params({}));
    expect(res.status).toBe(201);
    expect(prisma.plan.create).toHaveBeenCalledWith({ data: empresa });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: null, action: "CREATE", entity: "PLAN", actorId: "root" }),
    });
  });

  it("rechaza un código repetido", async () => {
    vi.mocked(prisma.plan.findUnique).mockResolvedValueOnce({ id: "plan_empresa" } as never);
    const res = await POST(await platformRequest("/api/platform/plans", { method: "POST", body: empresa }), params({}));
    expect(res.status).toBe(409);
    expect(prisma.plan.create).not.toHaveBeenCalled();
  });

  it("rechaza una función que no existe", async () => {
    const res = await POST(
      await platformRequest("/api/platform/plans", { method: "POST", body: { ...empresa, features: ["CAMARAS"] } }),
      params({})
    );
    expect(res.status).toBe(400);
  });

  it("un ADMIN de organización no puede crear planes", async () => {
    const res = await POST(
      await tenantRequest("/api/platform/plans", { role: "ADMIN" }, { method: "POST", body: empresa }),
      params({})
    );
    expect(res.status).toBe(403);
    expect(prisma.plan.create).not.toHaveBeenCalled();
  });
});
