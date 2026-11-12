import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", async () => {
  const { mockPrismaWithAudit } = await import("@/test/prisma");
  return {
    prisma: mockPrismaWithAudit({
      membership: {
        findFirst: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        update: vi.fn().mockResolvedValue({}),
      },
      notification: { create: vi.fn().mockResolvedValue({}) },
    }),
  };
});

import { prisma } from "@/lib/prisma";
import { PATCH } from "./route";
import { ORG_A, ORG_B, auditedIn, onlyInOrg, params, tenantRequest } from "@/test/tenant";

const pending = { id: "mbr-1", userId: "persona-1", user: { email: "persona@test.cl" } };

async function answer(
  action: unknown,
  as: Parameters<typeof tenantRequest>[1] = { role: "ADMIN" }
) {
  const req = await tenantRequest("/api/join-requests/mbr-1", as, { method: "PATCH", body: { action } });
  return PATCH(req, params({ id: "mbr-1" }));
}

describe("PATCH /api/join-requests/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.membership.findFirst).mockImplementation(onlyInOrg(ORG_A, pending));
  });

  it("acepta la solicitud: activa la membresía, avisa a la persona y deja auditoría", async () => {
    const res = await answer("approve");
    expect(res.status).toBe(200);
    expect(prisma.membership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "mbr-1", organizationId: ORG_A, status: "PENDING" } })
    );
    expect(prisma.membership.update).toHaveBeenCalledWith({
      where: { id: "mbr-1" },
      data: { status: "ACTIVE", active: true },
    });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: ORG_A, userId: "persona-1" }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(auditedIn(ORG_A, "CREATE", "USER"));
  });

  it("rechaza la solicitud sin activar nada ni avisar", async () => {
    const res = await answer("reject");
    expect(res.status).toBe(200);
    expect(prisma.membership.update).toHaveBeenCalledWith({
      where: { id: "mbr-1" },
      data: { status: "REJECTED", active: false, credentialId: null },
    });
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(auditedIn(ORG_A, "UPDATE", "USER"));
  });

  it("un ADMIN de otra organización no puede responder la solicitud", async () => {
    const res = await answer("approve", { role: "ADMIN", sub: "admin-b", organizationId: ORG_B });
    expect(res.status).toBe(404);
    expect(prisma.membership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "mbr-1", organizationId: ORG_B, status: "PENDING" } })
    );
    expect(prisma.membership.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("no acepta si el plan llegó al tope de usuarios, pero sí permite rechazar", async () => {
    vi.mocked(prisma.membership.count).mockResolvedValue(2);
    const blocked = await answer("approve", { role: "ADMIN", plan: { name: "Básico", maxUsers: 2 } });
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).code).toBe("PLAN_LIMIT");
    expect(prisma.membership.update).not.toHaveBeenCalled();
    const rejected = await answer("reject", { role: "ADMIN", plan: { name: "Básico", maxUsers: 2 } });
    expect(rejected.status).toBe(200);
    vi.mocked(prisma.membership.count).mockResolvedValue(0);
  });

  it("solo la administración responde solicitudes", async () => {
    for (const role of ["USER", "GUARD"] as const) {
      expect((await answer("approve", { role })).status).toBe(403);
    }
    expect(prisma.membership.findFirst).not.toHaveBeenCalled();
  });

  it("valida la acción", async () => {
    expect((await answer("activar")).status).toBe(400);
    expect(prisma.membership.update).not.toHaveBeenCalled();
  });
});
