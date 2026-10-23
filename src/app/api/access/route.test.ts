import { describe, expect, it, vi, beforeEach } from "vitest";
import { signQrToken } from "@/lib/qr";

const mockVehicle = {
  id: "vehicle-1",
  plate: "AB1234",
  ownerId: "user-1",
  authorized: true,
  currentBlockId: null,
  organizationId: "org-a",
};

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    user: { findUnique: vi.fn() },
    accessLog: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "log-1", block: null }),
    },
    parkingBlock: { findFirst: vi.fn() },
    organization: { findUnique: vi.fn().mockResolvedValue({ defaultBlockId: null }) },
    notification: { create: vi.fn().mockResolvedValue({}) },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";
import { ORG_A, ORG_B, onlyInOrg, params, scopedTo, tenantRequest } from "@/test/tenant";

async function post(body: Record<string, unknown>, organizationId = ORG_A) {
  const req = await tenantRequest("/api/access", { role: "GUARD", organizationId }, { method: "POST", body });
  return POST(req, params({}));
}

describe("GET /api/access", () => {
  beforeEach(() => vi.clearAllMocks());

  it("solo lista accesos de la organización de la sesión", async () => {
    await GET(await tenantRequest("/api/access", { role: "GUARD" }), params({}));
    expect(prisma.accessLog.findMany).toHaveBeenCalledWith(scopedTo(ORG_A));
  });

  it("no exporta CSV si el plan no incluye reportes", async () => {
    const req = await tenantRequest("/api/access?format=csv", {
      role: "ADMIN",
      plan: { name: "Profesional", features: ["QR", "INFRACTIONS"] },
    });
    const res = await GET(req, params({}));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("PLAN_FEATURE");
    expect(prisma.accessLog.findMany).not.toHaveBeenCalled();
  });

  it("a un USER además lo limita a sus vehículos", async () => {
    await GET(await tenantRequest("/api/access", { role: "USER", sub: "user-1" }), params({}));
    expect(prisma.accessLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG_A, vehicle: { ownerId: "user-1" } } })
    );
  });
});

describe("POST /api/access con QR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.vehicle.findFirst).mockImplementation(onlyInOrg(ORG_A, mockVehicle));
  });

  it("acepta un QR firmado y vigente", async () => {
    const res = await post({ qrToken: signQrToken(mockVehicle.id), method: "QR", direction: "IN" });
    expect(res.status).toBe(201);
    expect(prisma.vehicle.findFirst).toHaveBeenCalledWith({ where: { id: mockVehicle.id, organizationId: ORG_A } });
  });

  it("rechaza un QR con firma manipulada (regresión del bug de verificación)", async () => {
    const qr = signQrToken(mockVehicle.id);
    const lastChar = qr.slice(-1);
    const tampered = qr.slice(0, -1) + (lastChar === "f" ? "0" : "f");
    const res = await post({ qrToken: tampered, method: "QR", direction: "IN" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/inv[aá]lido/i);
  });

  it("rechaza un QR expirado", async () => {
    const res = await post({ qrToken: signQrToken(mockVehicle.id, Date.now() - 6 * 60_000), method: "QR", direction: "IN" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/expirado/i);
  });

  it("no acepta QR si el plan no incluye QR", async () => {
    const req = await tenantRequest(
      "/api/access",
      { role: "GUARD", plan: { name: "Sin QR", features: [] } },
      { method: "POST", body: { qrToken: signQrToken(mockVehicle.id), method: "QR", direction: "IN" } }
    );
    const res = await POST(req, params({}));
    expect(res.status).toBe(403);
    expect(prisma.vehicle.findFirst).not.toHaveBeenCalled();
  });

  it("no registra el QR válido de un vehículo de otra organización", async () => {
    const res = await post({ qrToken: signQrToken(mockVehicle.id), method: "QR", direction: "IN" }, ORG_B);
    expect(res.status).toBe(404);
    expect(prisma.accessLog.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.vehicle.findUnique).mockResolvedValue(mockVehicle as never);
  });

  it("un USER no puede registrar accesos", async () => {
    const req = await tenantRequest(
      "/api/access",
      { role: "USER", sub: "user-1" },
      { method: "POST", body: { plate: "AB1234", method: "PLATE", direction: "IN" } }
    );
    const res = await POST(req, params({}));
    expect(res.status).toBe(403);
    expect(prisma.vehicle.findUnique).not.toHaveBeenCalled();
    expect(prisma.accessLog.create).not.toHaveBeenCalled();
  });

  it("busca la patente dentro de la organización de la sesión", async () => {
    await post({ plate: "ab 1234", method: "PLATE", direction: "IN" });
    expect(prisma.vehicle.findUnique).toHaveBeenCalledWith({
      where: { organizationId_plate: { organizationId: ORG_A, plate: "AB1234" } },
    });
  });

  it("rechaza un bloque de otra organización", async () => {
    vi.mocked(prisma.parkingBlock.findFirst).mockImplementation(
      onlyInOrg(ORG_B, { id: "block-b", name: "B", capacity: 10 })
    );
    const res = await post({ plate: "AB1234", method: "PLATE", direction: "IN", blockId: "block-b" });
    expect(res.status).toBe(404);
    expect(prisma.parkingBlock.findFirst).toHaveBeenCalledWith({ where: { id: "block-b", organizationId: ORG_A } });
    expect(prisma.accessLog.create).not.toHaveBeenCalled();
  });

  it("guarda la organización en el registro y en la notificación", async () => {
    const res = await post({ plate: "AB1234", method: "PLATE", direction: "OUT" });
    expect(res.status).toBe(201);
    expect(prisma.accessLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ organizationId: ORG_A }) })
    );
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: ORG_A }),
    });
  });

  it("usa el bloque por defecto de su propia organización", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ defaultBlockId: "default-a" } as never);
    vi.mocked(prisma.parkingBlock.findFirst).mockImplementation(
      onlyInOrg(ORG_A, { id: "default-a", name: "No definido", capacity: 100 })
    );
    const res = await post({ plate: "AB1234", method: "PLATE", direction: "IN" });
    expect(res.status).toBe(201);
    expect(prisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: ORG_A },
      select: { defaultBlockId: true },
    });
    expect(prisma.vehicle.update).toHaveBeenCalledWith({
      where: { id: mockVehicle.id },
      data: { currentBlockId: "default-a" },
    });
  });
});
