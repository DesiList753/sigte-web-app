import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", async () => {
  const { mockPrismaWithAudit } = await import("@/test/prisma");
  return {
    prisma: mockPrismaWithAudit({
      infraction: {
        findFirst: vi.fn(),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "inf-1", ...data })),
      },
    }),
  };
});

import { prisma } from "@/lib/prisma";
import { PATCH } from "./route";
import { ORG_A, ORG_B, auditedIn, onlyInOrg, params, tenantRequest } from "@/test/tenant";

const openInfraction = {
  id: "inf-1",
  userId: "user-1",
  status: "OPEN",
  organizationId: ORG_A,
  vehicle: { plate: "AB1234" },
};

async function callPatch(
  role: "USER" | "GUARD" | "ADMIN",
  sub: string,
  body: Record<string, unknown>,
  organizationId = ORG_A
) {
  const req = await tenantRequest("/api/infractions/inf-1", { role, sub, organizationId }, { method: "PATCH", body });
  return PATCH(req, params({ id: "inf-1" }));
}

describe("PATCH /api/infractions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.infraction.findFirst).mockImplementation(onlyInOrg(ORG_A, openInfraction));
  });

  it("permite al dueño reconocer su propia infracción abierta", async () => {
    const res = await callPatch("USER", "user-1", { status: "ACKNOWLEDGED" });
    expect(res.status).toBe(200);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("rechaza a un USER que no es el dueño de la infracción (IDOR)", async () => {
    const res = await callPatch("USER", "user-2", { status: "ACKNOWLEDGED" });
    expect(res.status).toBe(403);
  });

  it("rechaza que un USER intente resolver (solo puede reconocer)", async () => {
    const res = await callPatch("USER", "user-1", { status: "RESOLVED" });
    expect(res.status).toBe(403);
  });

  it("permite a GUARD resolver y guarda trazabilidad de quién resolvió", async () => {
    const res = await callPatch("GUARD", "guard-1", { status: "RESOLVED", resolution: "pagó la multa" });
    expect(res.status).toBe(200);
    expect(prisma.infraction.update).toHaveBeenCalledWith({
      where: { id: "inf-1" },
      data: expect.objectContaining({
        status: "RESOLVED",
        resolvedById: "guard-1",
        resolution: "pagó la multa",
      }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(auditedIn(ORG_A, "RESOLVE", "INFRACTION"));
  });

  it("un ADMIN de otra organización no puede tocar la infracción", async () => {
    const res = await callPatch("ADMIN", "admin-b", { status: "DISMISSED" }, ORG_B);
    expect(res.status).toBe(404);
    expect(prisma.infraction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "inf-1", organizationId: ORG_B } })
    );
    expect(prisma.infraction.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
