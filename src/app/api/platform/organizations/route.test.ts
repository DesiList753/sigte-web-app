import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/usage", () => ({
  usageByOrganization: vi.fn().mockResolvedValue({
    get: (id: string) => ({ users: id === "org-a" ? 5 : 0, guards: 1, admins: 1, blocks: 2, vehicles: 3, accessesThisMonth: 40 }),
  }),
}));

vi.mock("@/lib/prisma", async () => {
  const { mockPrismaWithAudit } = await import("@/test/prisma");
  return {
    prisma: mockPrismaWithAudit({
      organization: {
        findMany: vi.fn().mockResolvedValue([{ id: "org-a", slug: "a", displayName: "A" }]),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "org-new", ...data })),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "admin-new", ...data })),
      },
      plan: { findUnique: vi.fn().mockResolvedValue({ id: "plan_basico", code: "basico" }) },
      parkingBlock: { create: vi.fn().mockResolvedValue({ id: "block-new" }) },
    }),
  };
});

import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";
import { params, platformRequest, tenantRequest } from "@/test/tenant";

const body = {
  name: "Clínica Ejemplo",
  displayName: "Clínica",
  slug: "clinica",
  planId: "plan_basico",
  admin: { name: "Ana Admin", email: "Ana@Clinica.cl", password: "segura1234" },
};

async function create(payload: Record<string, unknown> = body) {
  return POST(await platformRequest("/api/platform/organizations", { method: "POST", body: payload }), params({}));
}

describe("GET /api/platform/organizations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lista las organizaciones con su uso", async () => {
    const res = await GET(await platformRequest("/api/platform/organizations"), params({}));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.organizations[0].usage.users).toBe(5);
  });

  it("rechaza al ADMIN de una organización", async () => {
    const res = await GET(await tenantRequest("/api/platform/organizations", { role: "ADMIN" }), params({}));
    expect(res.status).toBe(403);
    expect(prisma.organization.findMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/platform/organizations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("crea la organización, su bloque por defecto y su primer admin, con auditoría", async () => {
    const res = await create();
    expect(res.status).toBe(201);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.organization.create).toHaveBeenCalledWith({
      data: { name: "Clínica Ejemplo", displayName: "Clínica", slug: "clinica", planId: "plan_basico" },
    });
    expect(prisma.parkingBlock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: "org-new", name: "No definido", defaultOf: { connect: { id: "org-new" } } }),
    });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: "ana@clinica.cl", memberships: { create: { organizationId: "org-new", role: "ADMIN" } } }),
    });
    expect(prisma.auditLog.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ organizationId: "org-new", action: "CREATE", entity: "ORGANIZATION", actorId: "root" }),
        expect.objectContaining({ organizationId: "org-new", action: "CREATE", entity: "USER", entityId: "admin-new" }),
      ],
    });
  });

  it("rechaza un slug repetido", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce({ id: "otra" } as never);
    const res = await create();
    expect(res.status).toBe(409);
    expect(prisma.organization.create).not.toHaveBeenCalled();
  });

  it("rechaza un correo de administrador ya registrado", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: "existe" } as never);
    const res = await create();
    expect(res.status).toBe(409);
    expect(prisma.organization.create).not.toHaveBeenCalled();
  });

  it("rechaza un slug con formato inválido", async () => {
    const res = await create({ ...body, slug: "Con Espacios" });
    expect(res.status).toBe(400);
  });

  it("un ADMIN de organización no puede crear organizaciones", async () => {
    const res = await POST(
      await tenantRequest("/api/platform/organizations", { role: "ADMIN" }, { method: "POST", body }),
      params({})
    );
    expect(res.status).toBe(403);
    expect(prisma.organization.create).not.toHaveBeenCalled();
  });
});
