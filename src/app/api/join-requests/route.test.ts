import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { membership: { findMany: vi.fn().mockResolvedValue([]) } },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";
import { ORG_A, ORG_B, params, tenantRequest } from "@/test/tenant";

describe("GET /api/join-requests", () => {
  beforeEach(() => vi.clearAllMocks());

  it("solo lista las solicitudes pendientes de la organización de la sesión", async () => {
    await GET(await tenantRequest("/api/join-requests", { role: "ADMIN" }), params({}));
    expect(prisma.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG_A, status: "PENDING" } })
    );
    await GET(await tenantRequest("/api/join-requests", { role: "ADMIN", organizationId: ORG_B }), params({}));
    expect(prisma.membership.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { organizationId: ORG_B, status: "PENDING" } })
    );
  });

  it("devuelve los datos de la persona junto a su solicitud", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValueOnce([
      {
        id: "mbr-1",
        userType: null,
        updatedAt: new Date("2026-11-10T12:00:00Z"),
        user: { name: "Persona", email: "persona@test.cl", phone: null, rut: null },
      },
    ] as never);
    const res = await GET(await tenantRequest("/api/join-requests", { role: "ADMIN" }), params({}));
    const { requests } = await res.json();
    expect(requests).toEqual([
      expect.objectContaining({ id: "mbr-1", name: "Persona", email: "persona@test.cl", requestedAt: "2026-11-10T12:00:00.000Z" }),
    ]);
  });

  it("solo la administración ve las solicitudes", async () => {
    for (const role of ["USER", "GUARD"] as const) {
      const res = await GET(await tenantRequest("/api/join-requests", { role }), params({}));
      expect(res.status).toBe(403);
    }
    expect(prisma.membership.findMany).not.toHaveBeenCalled();
  });
});
