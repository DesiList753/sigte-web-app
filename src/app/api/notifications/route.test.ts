import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(3),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";
import { ORG_A, params, tenantRequest } from "@/test/tenant";

describe("/api/notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("solo devuelve las notificaciones del usuario en la organización activa", async () => {
    await GET(await tenantRequest("/api/notifications", { role: "USER", sub: "user-a" }), params({}));
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG_A, userId: "user-a" } })
    );
  });

  it("entrega solo el contador de no leídas cuando se pide summary=true", async () => {
    const res = await GET(
      await tenantRequest("/api/notifications?summary=true", { role: "USER", sub: "user-a" }),
      params({})
    );
    expect(await res.json()).toEqual({ unreadCount: 3 });
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { organizationId: ORG_A, userId: "user-a", read: false },
    });
  });

  it("solo marca como leídas las notificaciones propias dentro de la organización activa", async () => {
    const req = await tenantRequest(
      "/api/notifications",
      { role: "USER", sub: "user-a" },
      { method: "POST", body: { ids: ["n-1", "n-ajena"] } }
    );
    await POST(req, params({}));
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["n-1", "n-ajena"] }, organizationId: ORG_A, userId: "user-a" },
      data: { read: true },
    });
  });

  it("permite marcar todas las no leídas de su organización con all=true", async () => {
    const req = await tenantRequest(
      "/api/notifications",
      { role: "GUARD", sub: "guard-a" },
      { method: "POST", body: { all: true } }
    );
    await POST(req, params({}));
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { organizationId: ORG_A, userId: "guard-a", read: false },
      data: { read: true },
    });
  });
});
