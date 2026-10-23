import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";
import { params, tenantRequest } from "@/test/tenant";

describe("/api/notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("solo devuelve las notificaciones del usuario de la sesión", async () => {
    await GET(await tenantRequest("/api/notifications", { role: "USER", sub: "user-a" }), params({}));
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-a" } })
    );
  });

  it("solo marca como leídas las notificaciones propias", async () => {
    const req = await tenantRequest(
      "/api/notifications",
      { role: "USER", sub: "user-a" },
      { method: "POST", body: { ids: ["n-1", "n-ajena"] } }
    );
    await POST(req, params({}));
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["n-1", "n-ajena"] }, userId: "user-a" },
      data: { read: true },
    });
  });
});
