import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/usage", () => ({
  usageByOrganization: vi.fn().mockResolvedValue({
    get: () => ({ users: 0, guards: 0, admins: 1, blocks: 1, vehicles: 0, accessesThisMonth: 0 }),
  }),
}));

vi.mock("@/lib/plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/plan")>()),
  limitUsage: vi.fn().mockResolvedValue({
    users: { used: 1, max: 100 },
    guards: { used: 3, max: 2 },
    blocks: { used: 0, max: 3 },
    vehicles: { used: 0, max: 150 },
  }),
}));

vi.mock("@/lib/prisma", async () => {
  const { mockPrismaWithAudit } = await import("@/test/prisma");
  return {
    prisma: mockPrismaWithAudit({
      organization: {
        findUnique: vi.fn(),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "org-a", ...data })),
      },
      plan: { findUnique: vi.fn().mockResolvedValue({ id: "plan_pro", code: "profesional" }) },
    }),
  };
});

import { prisma } from "@/lib/prisma";
import { GET, PATCH } from "./route";
import { params, platformRequest, tenantRequest } from "@/test/tenant";

const current = {
  id: "org-a",
  slug: "org-a",
  name: "Organización A",
  displayName: "A",
  status: "ACTIVE",
  planId: "plan_basico",
  plan: { code: "basico" },
  logoUrl: null,
  brandColor: null,
  registrationForm: "BASIC",
  selfRegistration: true,
  allowedEmailDomains: [],
};

async function patch(body: Record<string, unknown>) {
  return PATCH(
    await platformRequest("/api/platform/organizations/org-a", { method: "PATCH", body }),
    params({ id: "org-a" })
  );
}

function auditActions() {
  const call = vi.mocked(prisma.auditLog.createMany).mock.calls[0]?.[0] as { data: { action: string }[] } | undefined;
  return call?.data.map((d) => d.action) ?? [];
}

describe("PATCH /api/platform/organizations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.organization.findUnique).mockImplementation((async (args: { where: { id?: string } }) =>
      args.where.id === "org-a" ? current : null) as never);
  });

  it("suspender deja un registro SUSPEND en la organización", async () => {
    const res = await patch({ status: "SUSPENDED" });
    expect(res.status).toBe(200);
    expect(prisma.organization.update).toHaveBeenCalledWith({ where: { id: "org-a" }, data: { status: "SUSPENDED" } });
    expect(auditActions()).toEqual(["SUSPEND"]);
    expect(prisma.auditLog.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ organizationId: "org-a", entity: "ORGANIZATION", actorId: "root" })],
    });
  });

  it("reactivar deja un registro REACTIVATE", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce({ ...current, status: "SUSPENDED" } as never);
    await patch({ status: "ACTIVE" });
    expect(auditActions()).toEqual(["REACTIVATE"]);
  });

  it("cambiar el plan guarda el plan anterior y el nuevo", async () => {
    await patch({ planId: "plan_pro" });
    expect(prisma.organization.update).toHaveBeenCalledWith({ where: { id: "org-a" }, data: { planId: "plan_pro" } });
    expect(prisma.auditLog.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ action: "PLAN_CHANGE", detail: { from: "basico", to: "profesional" } })],
    });
  });

  it("editar datos registra solo los campos que cambiaron", async () => {
    await patch({ displayName: "Nueva A", name: "Organización A", brandColor: "#123456" });
    expect(prisma.auditLog.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ action: "UPDATE", detail: { fields: ["displayName", "brandColor"] } })],
    });
  });

  it("sin cambios reales no escribe auditoría", async () => {
    await patch({ status: "ACTIVE", planId: "plan_basico" });
    expect(prisma.auditLog.createMany).not.toHaveBeenCalled();
  });

  it("rechaza un color inválido", async () => {
    const res = await patch({ brandColor: "azul" });
    expect(res.status).toBe(400);
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it("responde 404 si la organización no existe", async () => {
    const res = await PATCH(
      await platformRequest("/api/platform/organizations/nope", { method: "PATCH", body: { status: "SUSPENDED" } }),
      params({ id: "nope" })
    );
    expect(res.status).toBe(404);
  });

  it("un ADMIN de organización no puede suspender organizaciones", async () => {
    const res = await PATCH(
      await tenantRequest("/api/platform/organizations/org-a", { role: "ADMIN" }, { method: "PATCH", body: { status: "SUSPENDED" } }),
      params({ id: "org-a" })
    );
    expect(res.status).toBe(403);
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });
});

describe("GET /api/platform/organizations/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("responde 404 si la organización no existe", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce(null);
    const res = await GET(await platformRequest("/api/platform/organizations/nope"), params({ id: "nope" }));
    expect(res.status).toBe(404);
  });

  it("devuelve los administradores de la organización", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce({
      ...current,
      memberships: [{ active: true, createdAt: new Date(), user: { id: "admin-a", name: "Admin A", email: "a@a.cl" } }],
    } as never);
    const res = await GET(await platformRequest("/api/platform/organizations/org-a"), params({ id: "org-a" }));
    const data = await res.json();
    expect(data.organization.admins).toHaveLength(1);
    expect(data.organization.admins[0]).toMatchObject({ id: "admin-a", email: "a@a.cl", active: true });
    expect(data.organization.limits.guards).toEqual({ used: 3, max: 2 });
    expect(prisma.organization.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ memberships: expect.objectContaining({ where: { role: "ADMIN" } }) }),
      })
    );
  });
});
