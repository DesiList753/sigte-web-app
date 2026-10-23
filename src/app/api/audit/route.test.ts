import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";
import { ORG_A, ORG_B, params, platformRequest, scopedTo, tenantRequest } from "@/test/tenant";

describe("GET /api/audit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("el ADMIN solo ve el registro de su organización", async () => {
    await GET(await tenantRequest("/api/audit", { role: "ADMIN" }), params({}));
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(scopedTo(ORG_A));
  });

  it("el ADMIN de otra organización ve solo la suya", async () => {
    await GET(await tenantRequest("/api/audit", { role: "ADMIN", organizationId: ORG_B }), params({}));
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(scopedTo(ORG_B));
  });

  it("un GUARD no ve la auditoría", async () => {
    const res = await GET(await tenantRequest("/api/audit", { role: "GUARD" }), params({}));
    expect(res.status).toBe(403);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it("el SUPER_ADMIN usa el registro de plataforma, no este", async () => {
    const res = await GET(await platformRequest("/api/audit"), params({}));
    expect(res.status).toBe(403);
  });
});
