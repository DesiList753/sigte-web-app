import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";
import { params, platformRequest, tenantRequest } from "@/test/tenant";

describe("GET /api/platform/audit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("VanillaSoft ve el registro de todas las organizaciones", async () => {
    await GET(await platformRequest("/api/platform/audit"), params({}));
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it("puede filtrar por organización", async () => {
    await GET(await platformRequest("/api/platform/audit?organizationId=org-b"), params({}));
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org-b" } }));
  });

  it("un ADMIN de organización no puede ver el registro global", async () => {
    const res = await GET(await tenantRequest("/api/platform/audit", { role: "ADMIN" }), params({}));
    expect(res.status).toBe(403);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });
});
