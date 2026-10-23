import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    plan: { findMany: vi.fn().mockResolvedValue([{ id: "plan_basico", name: "Básico" }]) },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";
import { params, platformRequest, tenantRequest } from "@/test/tenant";

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
