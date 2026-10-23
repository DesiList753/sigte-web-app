import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "new-user", ...data })),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";
import { ORG_A, params, scopedTo, tenantRequest } from "@/test/tenant";

const newUser = { email: "Nuevo@Test.cl", password: "segura1", name: "Nuevo", role: "GUARD" };

describe("GET /api/users", () => {
  beforeEach(() => vi.clearAllMocks());

  it("solo lista usuarios de la organización de la sesión", async () => {
    await GET(await tenantRequest("/api/users", { role: "ADMIN" }), params({}));
    expect(prisma.user.findMany).toHaveBeenCalledWith(scopedTo(ORG_A));
  });

  it("la búsqueda también queda dentro de la organización", async () => {
    await GET(await tenantRequest("/api/users?q=ana", { role: "ADMIN" }), params({}));
    expect(prisma.user.findMany).toHaveBeenCalledWith(
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

  it("crea al usuario en la organización de la sesión", async () => {
    const req = await tenantRequest("/api/users", { role: "ADMIN" }, { method: "POST", body: { ...newUser, organizationId: "org-b" } });
    const res = await POST(req, params({}));
    expect(res.status).toBe(201);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ organizationId: ORG_A, email: "nuevo@test.cl" }) })
    );
  });

  it("revisa la credencial repetida solo dentro de la organización", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "otro" } as never);
    const req = await tenantRequest("/api/users", { role: "ADMIN" }, { method: "POST", body: { ...newUser, universityId: "C-1" } });
    const res = await POST(req, params({}));
    expect(res.status).toBe(409);
    expect(prisma.user.findUnique).toHaveBeenLastCalledWith({
      where: { organizationId_universityId: { organizationId: ORG_A, universityId: "C-1" } },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
