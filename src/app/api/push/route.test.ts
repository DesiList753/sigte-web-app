import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pushToken: {
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { DELETE, POST } from "./route";
import { params, tenantRequest } from "@/test/tenant";

describe("/api/push", () => {
  beforeEach(() => vi.clearAllMocks());

  it("registra el token a nombre del usuario de la sesión", async () => {
    const req = await tenantRequest("/api/push", { role: "USER", sub: "user-a" }, { method: "POST", body: { token: "t-1" } });
    await POST(req, params({}));
    expect(prisma.pushToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ userId: "user-a" }) })
    );
  });

  it("solo borra tokens propios", async () => {
    const req = await tenantRequest("/api/push", { role: "USER", sub: "user-a" }, { method: "DELETE", body: { token: "t-1" } });
    await DELETE(req, params({}));
    expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({ where: { token: "t-1", userId: "user-a" } });
  });
});
