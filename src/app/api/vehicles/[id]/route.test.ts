import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", async () => {
  const { mockPrismaWithAudit } = await import("@/test/prisma");
  return {
    prisma: mockPrismaWithAudit({
      vehicle: {
        findFirst: vi.fn(),
        update: vi.fn().mockResolvedValue({ id: "vehicle-1" }),
        delete: vi.fn().mockResolvedValue({ id: "vehicle-1" }),
      },
      notification: { create: vi.fn().mockResolvedValue({}) },
    }),
  };
});

import { prisma } from "@/lib/prisma";
import { DELETE, PATCH } from "./route";
import { ORG_A, ORG_B, auditedIn, onlyInOrg, params, tenantRequest } from "@/test/tenant";

const ownedVehicle = { id: "vehicle-1", ownerId: "user-1", plate: "AB1234", organizationId: ORG_A, status: "APPROVED" };
const pendingVehicle = { ...ownedVehicle, status: "PENDING" };

async function callPatch(
  role: "USER" | "GUARD" | "ADMIN",
  sub: string,
  body: Record<string, unknown> = { color: "Rojo" },
  organizationId = ORG_A
) {
  const req = await tenantRequest("/api/vehicles/vehicle-1", { role, sub, organizationId }, { method: "PATCH", body });
  return PATCH(req, params({ id: "vehicle-1" }));
}

async function callDelete(role: "USER" | "GUARD" | "ADMIN", sub: string, organizationId = ORG_A) {
  const req = await tenantRequest("/api/vehicles/vehicle-1", { role, sub, organizationId }, { method: "DELETE" });
  return DELETE(req, params({ id: "vehicle-1" }));
}

describe("PATCH /api/vehicles/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.vehicle.findFirst).mockImplementation(onlyInOrg(ORG_A, ownedVehicle));
  });

  it("permite al dueño editar su propio vehículo", async () => {
    const res = await callPatch("USER", "user-1");
    expect(res.status).toBe(200);
  });

  it("rechaza a un USER que no es el dueño (IDOR)", async () => {
    const res = await callPatch("USER", "user-2");
    expect(res.status).toBe(403);
  });

  it("un USER no puede cambiar la autorización de su vehículo", async () => {
    const res = await callPatch("USER", "user-1", { authorized: true });
    expect(res.status).toBe(403);
    expect(prisma.vehicle.update).not.toHaveBeenCalled();
  });

  it("permite a GUARD editar un vehículo que no es suyo", async () => {
    const res = await callPatch("GUARD", "guard-1", { authorized: false });
    expect(res.status).toBe(200);
  });

  it("permite a ADMIN editar cualquier vehículo de su organización", async () => {
    const res = await callPatch("ADMIN", "admin-1");
    expect(res.status).toBe(200);
  });

  it("un ADMIN de otra organización no puede editar el vehículo", async () => {
    const res = await callPatch("ADMIN", "admin-b", { authorized: true }, ORG_B);
    expect(res.status).toBe(404);
    expect(prisma.vehicle.findFirst).toHaveBeenCalledWith({ where: { id: "vehicle-1", organizationId: ORG_B } });
    expect(prisma.vehicle.update).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/vehicles/[id] con una solicitud de vehículo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.vehicle.findFirst).mockImplementation(onlyInOrg(ORG_A, pendingVehicle));
  });

  it("el ADMIN aprueba: autoriza el vehículo, avisa al dueño y deja auditoría", async () => {
    const res = await callPatch("ADMIN", "admin-1", { status: "APPROVED" });
    expect(res.status).toBe(200);
    expect(prisma.vehicle.update).toHaveBeenCalledWith({
      where: { id: "vehicle-1" },
      data: { status: "APPROVED", authorized: true },
    });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: ORG_A, userId: "user-1" }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(auditedIn(ORG_A, "UPDATE", "VEHICLE"));
  });

  it("el ADMIN rechaza y el vehículo queda sin autorización", async () => {
    await callPatch("ADMIN", "admin-1", { status: "REJECTED", authorized: true });
    expect(prisma.vehicle.update).toHaveBeenCalledWith({
      where: { id: "vehicle-1" },
      data: { status: "REJECTED", authorized: false },
    });
  });

  it("ni el dueño ni un GUARD pueden responder la solicitud", async () => {
    expect((await callPatch("USER", "user-1", { status: "APPROVED" })).status).toBe(403);
    expect((await callPatch("GUARD", "guard-1", { status: "APPROVED" })).status).toBe(403);
    expect(prisma.vehicle.update).not.toHaveBeenCalled();
  });

  it("no se puede autorizar un vehículo pendiente saltándose la aprobación", async () => {
    const res = await callPatch("GUARD", "guard-1", { authorized: true });
    expect(res.status).toBe(409);
    expect(prisma.vehicle.update).not.toHaveBeenCalled();
  });

  it("un ADMIN de otra organización no puede aprobar el vehículo", async () => {
    const res = await callPatch("ADMIN", "admin-b", { status: "APPROVED" }, ORG_B);
    expect(res.status).toBe(404);
    expect(prisma.vehicle.update).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/vehicles/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.vehicle.findFirst).mockImplementation(onlyInOrg(ORG_A, ownedVehicle));
  });

  it("permite al dueño eliminar su propio vehículo", async () => {
    const res = await callDelete("USER", "user-1");
    expect(res.status).toBe(200);
  });

  it("rechaza a un USER que no es el dueño (IDOR)", async () => {
    const res = await callDelete("USER", "user-2");
    expect(res.status).toBe(403);
  });

  it("permite a ADMIN eliminar cualquier vehículo de su organización", async () => {
    const res = await callDelete("ADMIN", "admin-1");
    expect(res.status).toBe(200);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(auditedIn(ORG_A, "DELETE", "VEHICLE"));
  });

  it("un ADMIN de otra organización no puede eliminar el vehículo", async () => {
    const res = await callDelete("ADMIN", "admin-b", ORG_B);
    expect(res.status).toBe(404);
    expect(prisma.vehicle.delete).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
