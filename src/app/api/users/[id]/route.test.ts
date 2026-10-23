import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", async () => {
  const { mockPrismaWithAudit } = await import("@/test/prisma");
  return {
    prisma: mockPrismaWithAudit({
      user: {
        findFirst: vi.fn(),
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(1),
        update: vi.fn().mockResolvedValue({ id: "target-1", role: "GUARD" }),
        delete: vi.fn().mockResolvedValue({ id: "target-1" }),
      },
      infraction: { count: vi.fn().mockResolvedValue(0) },
    }),
  };
});

import { prisma } from "@/lib/prisma";
import { DELETE, PATCH } from "./route";
import { ORG_A, ORG_B, auditedIn, onlyInOrg, params, tenantRequest } from "@/test/tenant";

const target = { id: "target-1", email: "target@test.cl", role: "USER", active: true, universityId: null };

async function callPatch(
  role: "USER" | "GUARD" | "ADMIN",
  sub: string,
  body: Record<string, unknown>,
  organizationId = ORG_A
) {
  const req = await tenantRequest("/api/users/target-1", { role, sub, organizationId }, { method: "PATCH", body });
  return PATCH(req, params({ id: "target-1" }));
}

async function callDelete(sub: string, targetId: string, organizationId = ORG_A) {
  const req = await tenantRequest(`/api/users/${targetId}`, { role: "ADMIN", sub, organizationId }, { method: "DELETE" });
  return DELETE(req, params({ id: targetId }));
}

describe("PATCH /api/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findFirst).mockImplementation(onlyInOrg(ORG_A, target));
  });

  it("permite a un ADMIN cambiar el rol de otro usuario", async () => {
    const res = await callPatch("ADMIN", "admin-1", { role: "GUARD" });
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "target-1" },
      data: { role: "GUARD" },
      select: expect.any(Object),
    });
    expect(prisma.auditLog.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          organizationId: ORG_A,
          action: "ROLE_CHANGE",
          entity: "USER",
          entityId: "target-1",
          detail: { email: "target@test.cl", from: "USER", to: "GUARD" },
        }),
      ],
    });
  });

  it("no registra auditoría si el rol no cambia", async () => {
    await callPatch("ADMIN", "admin-1", { role: "USER", name: "Otro nombre" });
    expect(prisma.auditLog.createMany).not.toHaveBeenCalled();
  });

  it("rechaza a un GUARD (no es ADMIN)", async () => {
    const res = await callPatch("GUARD", "guard-1", { role: "ADMIN" });
    expect(res.status).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rechaza a un USER (no es ADMIN)", async () => {
    const res = await callPatch("USER", "user-1", { role: "ADMIN" });
    expect(res.status).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("un ADMIN de otra organización no puede editar al usuario", async () => {
    const res = await callPatch("ADMIN", "admin-b", { role: "ADMIN" }, ORG_B);
    expect(res.status).toBe(404);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "target-1", organizationId: ORG_B } })
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("no permite dejar a la organización sin administradores activos", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ ...target, id: "target-1", role: "ADMIN" } as never);
    vi.mocked(prisma.user.count).mockResolvedValueOnce(0);
    const res = await callPatch("ADMIN", "target-1", { role: "USER" });
    expect(res.status).toBe(409);
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: { organizationId: ORG_A, role: "ADMIN", active: true, NOT: { id: "target-1" } },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findFirst).mockImplementation(onlyInOrg(ORG_A, target));
  });

  it("un ADMIN puede eliminar a otro usuario", async () => {
    const res = await callDelete("admin-1", "target-1");
    expect(res.status).toBe(200);
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: "target-1" } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(auditedIn(ORG_A, "DELETE", "USER"));
  });

  it("un ADMIN no puede eliminarse a si mismo", async () => {
    const res = await callDelete("admin-1", "admin-1");
    expect(res.status).toBe(400);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it("un ADMIN de otra organización no puede eliminar al usuario", async () => {
    const res = await callDelete("admin-b", "target-1", ORG_B);
    expect(res.status).toBe(404);
    expect(prisma.user.delete).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("no elimina a quien registró infracciones y sugiere desactivarlo", async () => {
    vi.mocked(prisma.infraction.count).mockResolvedValueOnce(3);
    const res = await callDelete("admin-1", "target-1");
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/desact/i);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });
});
