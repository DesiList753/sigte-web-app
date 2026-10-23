import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", async () => {
  const { mockPrismaWithAudit } = await import("@/test/prisma");
  return {
    prisma: mockPrismaWithAudit({
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "new-user", email: data.email, name: data.name })),
      },
      membership: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({ role: data.role, credentialId: data.credentialId ?? null, active: true })
        ),
      },
    }),
  };
});

import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";
import { ORG_A, auditedIn, params, scopedTo, tenantRequest } from "@/test/tenant";

const newUser = { email: "Nuevo@Test.cl", password: "segura1", name: "Nuevo", role: "GUARD" };

describe("GET /api/users", () => {
  beforeEach(() => vi.clearAllMocks());

  it("solo lista las membresías de la organización de la sesión", async () => {
    await GET(await tenantRequest("/api/users", { role: "ADMIN" }), params({}));
    expect(prisma.membership.findMany).toHaveBeenCalledWith(scopedTo(ORG_A));
  });

  it("entrega a cada persona con su rol en esta organización", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValueOnce([
      {
        role: "GUARD",
        active: true,
        credentialId: "G-1",
        user: { id: "u-1", email: "g@test.cl", name: "Guardia", rut: null, phone: null, _count: { vehicles: 0 } },
      },
    ] as never);
    const res = await GET(await tenantRequest("/api/users", { role: "ADMIN" }), params({}));
    const { users } = await res.json();
    expect(users[0]).toMatchObject({ id: "u-1", email: "g@test.cl", role: "GUARD", credentialId: "G-1" });
  });

  it("cuenta los vehículos de cada persona solo en esta organización", async () => {
    await GET(await tenantRequest("/api/users", { role: "ADMIN" }), params({}));
    const call = vi.mocked(prisma.membership.findMany).mock.calls[0][0] as {
      select: { user: { select: { _count: { select: { vehicles: { where: unknown } } } } } };
    };
    expect(call.select.user.select._count.select.vehicles.where).toEqual({ organizationId: ORG_A });
  });

  it("la búsqueda también queda dentro de la organización", async () => {
    await GET(await tenantRequest("/api/users?q=ana", { role: "ADMIN" }), params({}));
    expect(prisma.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: ORG_A, OR: expect.any(Array) }) })
    );
  });

  it("rechaza a un GUARD", async () => {
    const res = await GET(await tenantRequest("/api/users", { role: "GUARD" }), params({}));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/users", () => {
  beforeEach(() => vi.clearAllMocks());

  it("crea a la persona con su membresía en la organización de la sesión", async () => {
    const req = await tenantRequest("/api/users", { role: "ADMIN" }, { method: "POST", body: { ...newUser, organizationId: "org-b" } });
    const res = await POST(req, params({}));
    expect(res.status).toBe(201);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: "nuevo@test.cl", lastOrganizationId: ORG_A }) })
    );
    expect(prisma.membership.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "new-user", organizationId: ORG_A, role: "GUARD" }) })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(auditedIn(ORG_A, "CREATE", "USER"));
  });

  it("no suma a una persona que ya tiene cuenta y le pide que se una por el enlace", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: "existente" } as never);
    const req = await tenantRequest("/api/users", { role: "ADMIN" }, { method: "POST", body: newUser });
    const res = await POST(req, params({}));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/enlace de registro/);
    expect(prisma.membership.create).not.toHaveBeenCalled();
  });

  it("no crea un guardia si el plan llegó al tope de guardias", async () => {
    vi.mocked(prisma.membership.count).mockResolvedValueOnce(2);
    const req = await tenantRequest(
      "/api/users",
      { role: "ADMIN", plan: { name: "Básico", maxGuards: 2 } },
      { method: "POST", body: newUser }
    );
    const res = await POST(req, params({}));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("PLAN_LIMIT");
    expect(body.error).toBe("Tu plan Básico permite hasta 2 guardias. Contacta a VanillaSoft para ampliarlo.");
    expect(prisma.membership.count).toHaveBeenCalledWith({ where: { organizationId: ORG_A, active: true, role: "GUARD" } });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("revisa la credencial repetida solo dentro de la organización", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValueOnce({ userId: "otro" } as never);
    const req = await tenantRequest("/api/users", { role: "ADMIN" }, { method: "POST", body: { ...newUser, credentialId: "C-1" } });
    const res = await POST(req, params({}));
    expect(res.status).toBe(409);
    expect(prisma.membership.findUnique).toHaveBeenLastCalledWith({
      where: { organizationId_credentialId: { organizationId: ORG_A, credentialId: "C-1" } },
      select: { userId: true },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
