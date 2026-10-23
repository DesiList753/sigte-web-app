import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", async () => {
  const { mockPrismaWithAudit } = await import("@/test/prisma");
  return {
    prisma: mockPrismaWithAudit({
      user: { delete: vi.fn() },
      membership: {
        findUnique: vi.fn(),
        count: vi.fn().mockResolvedValue(1),
        update: vi.fn().mockResolvedValue({
          role: "GUARD",
          active: true,
          credentialId: null,
          user: { id: "target-1", email: "target@test.cl", name: "Target" },
        }),
        delete: vi.fn().mockResolvedValue({ id: "mbr-1" }),
      },
      vehicle: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      notification: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      infraction: { count: vi.fn().mockResolvedValue(0) },
    }),
  };
});

import { prisma } from "@/lib/prisma";
import { DELETE, PATCH } from "./route";
import { ORG_A, ORG_B, auditedIn, onlyMemberOf, params, tenantRequest } from "@/test/tenant";

const target = { id: "mbr-1", role: "USER", active: true, credentialId: null, user: { email: "target@test.cl" } };

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
    vi.mocked(prisma.membership.findUnique).mockImplementation(onlyMemberOf(ORG_A, target));
  });

  it("permite a un ADMIN cambiar el rol de otra persona en su organización", async () => {
    const res = await callPatch("ADMIN", "admin-1", { role: "GUARD" });
    expect(res.status).toBe(200);
    expect(prisma.membership.update).toHaveBeenCalledWith({
      where: { id: "mbr-1" },
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
    await callPatch("ADMIN", "admin-1", { role: "USER" });
    expect(prisma.auditLog.createMany).not.toHaveBeenCalled();
  });

  it("no deja que una organización cambie el nombre de la persona", async () => {
    await callPatch("ADMIN", "admin-1", { name: "Otro nombre", role: "GUARD" });
    expect(prisma.membership.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: "GUARD" } })
    );
  });

  it("rechaza a un GUARD (no es ADMIN)", async () => {
    const res = await callPatch("GUARD", "guard-1", { role: "ADMIN" });
    expect(res.status).toBe(403);
    expect(prisma.membership.update).not.toHaveBeenCalled();
  });

  it("rechaza a un USER (no es ADMIN)", async () => {
    const res = await callPatch("USER", "user-1", { role: "ADMIN" });
    expect(res.status).toBe(403);
    expect(prisma.membership.update).not.toHaveBeenCalled();
  });

  it("un ADMIN de otra organización no puede editar a la persona", async () => {
    const res = await callPatch("ADMIN", "admin-b", { role: "ADMIN" }, ORG_B);
    expect(res.status).toBe(404);
    expect(prisma.membership.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_organizationId: { userId: "target-1", organizationId: ORG_B } } })
    );
    expect(prisma.membership.update).not.toHaveBeenCalled();
  });

  it("no permite dejar a la organización sin administradores activos", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ ...target, role: "ADMIN" } as never);
    vi.mocked(prisma.membership.count).mockResolvedValueOnce(0);
    const res = await callPatch("ADMIN", "target-1", { role: "USER" });
    expect(res.status).toBe(409);
    expect(prisma.membership.count).toHaveBeenCalledWith({
      where: { organizationId: ORG_A, role: "ADMIN", active: true, NOT: { userId: "target-1" } },
    });
    expect(prisma.membership.update).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/users/[id] con límites del plan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.membership.findUnique).mockImplementation(onlyMemberOf(ORG_A, target));
  });

  async function patchWithPlan(body: Record<string, unknown>, plan: Record<string, unknown>) {
    const req = await tenantRequest(
      "/api/users/target-1",
      { role: "ADMIN", sub: "admin-1", plan },
      { method: "PATCH", body }
    );
    return PATCH(req, params({ id: "target-1" }));
  }

  it("no convierte en guardia si el plan llegó al tope de guardias", async () => {
    vi.mocked(prisma.membership.count).mockResolvedValueOnce(2);
    const res = await patchWithPlan({ role: "GUARD" }, { name: "Básico", maxGuards: 2 });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("PLAN_LIMIT");
    expect(prisma.membership.update).not.toHaveBeenCalled();
  });

  it("reactivar a alguien también respeta el tope de usuarios", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ ...target, active: false } as never);
    vi.mocked(prisma.membership.count).mockResolvedValueOnce(5);
    const res = await patchWithPlan({ active: true }, { name: "Básico", maxUsers: 5 });
    expect(res.status).toBe(403);
    expect(prisma.membership.update).not.toHaveBeenCalled();
  });

  it("pasar de usuario a admin no ocupa un cupo nuevo", async () => {
    const res = await patchWithPlan({ role: "ADMIN" }, { name: "Básico", maxUsers: 1 });
    expect(res.status).toBe(200);
    expect(prisma.membership.count).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.membership.findUnique).mockImplementation(onlyMemberOf(ORG_A, target));
  });

  it("quita a la persona de la organización sin borrar su cuenta", async () => {
    const res = await callDelete("admin-1", "target-1");
    expect(res.status).toBe(200);
    expect(prisma.membership.delete).toHaveBeenCalledWith({ where: { id: "mbr-1" } });
    expect(prisma.vehicle.deleteMany).toHaveBeenCalledWith({ where: { ownerId: "target-1", organizationId: ORG_A } });
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({ where: { userId: "target-1", organizationId: ORG_A } });
    expect(prisma.user.delete).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(auditedIn(ORG_A, "DELETE", "USER"));
  });

  it("un ADMIN no puede quitarse a sí mismo", async () => {
    const res = await callDelete("admin-1", "admin-1");
    expect(res.status).toBe(400);
    expect(prisma.membership.delete).not.toHaveBeenCalled();
  });

  it("un ADMIN de otra organización no puede quitar a la persona", async () => {
    const res = await callDelete("admin-b", "target-1", ORG_B);
    expect(res.status).toBe(404);
    expect(prisma.membership.delete).not.toHaveBeenCalled();
    expect(prisma.vehicle.deleteMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("no quita a quien registró infracciones en esta organización y sugiere desactivarlo", async () => {
    vi.mocked(prisma.infraction.count).mockResolvedValueOnce(3);
    const res = await callDelete("admin-1", "target-1");
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/desact/i);
    expect(prisma.infraction.count).toHaveBeenCalledWith({ where: { guardId: "target-1", organizationId: ORG_A } });
    expect(prisma.membership.delete).not.toHaveBeenCalled();
  });
});
