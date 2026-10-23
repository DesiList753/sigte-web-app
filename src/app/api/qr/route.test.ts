import { describe, expect, it, vi, beforeEach } from "vitest";
import { verifyQrToken } from "@/lib/qr";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: { findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";
import { ORG_A, ORG_B, onlyInOrg, params, tenantRequest } from "@/test/tenant";

const ownedVehicle = { id: "vehicle-1", ownerId: "user-1", plate: "AB1234", organizationId: ORG_A };

async function callGet(
  role: "USER" | "GUARD" | "ADMIN",
  sub: string,
  vehicleId = "vehicle-1",
  organizationId = ORG_A
) {
  const req = await tenantRequest(`/api/qr?vehicleId=${vehicleId}`, { role, sub, organizationId });
  return GET(req, params({}));
}

describe("GET /api/qr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.vehicle.findFirst).mockImplementation(onlyInOrg(ORG_A, ownedVehicle));
  });

  it("genera un QR firmado y valido para el dueño del vehiculo", async () => {
    const res = await callGet("USER", "user-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vehicle.plate).toBe("AB1234");

    const verified = verifyQrToken(body.token);
    expect(verified).toEqual({ ok: true, vehicleId: "vehicle-1", issuedAt: body.issuedAt });
  });

  it("rechaza a un USER que no es el dueño del vehiculo", async () => {
    const res = await callGet("USER", "user-2");
    expect(res.status).toBe(403);
  });

  it("permite a un GUARD generar el QR de un vehiculo de su organización", async () => {
    const res = await callGet("GUARD", "guard-1");
    expect(res.status).toBe(200);
  });

  it("un GUARD de otra organización no puede generar el QR", async () => {
    const res = await callGet("GUARD", "guard-b", "vehicle-1", ORG_B);
    expect(res.status).toBe(404);
    expect(prisma.vehicle.findFirst).toHaveBeenCalledWith({ where: { id: "vehicle-1", organizationId: ORG_B } });
  });

  it("no genera QR si el plan no incluye QR", async () => {
    const req = await tenantRequest("/api/qr?vehicleId=vehicle-1", {
      role: "USER",
      sub: "user-1",
      plan: { name: "Básico", features: [] },
    });
    const res = await GET(req, params({}));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("PLAN_FEATURE");
    expect(prisma.vehicle.findFirst).not.toHaveBeenCalled();
  });

  it("responde 404 si el vehiculo no existe", async () => {
    vi.mocked(prisma.vehicle.findFirst).mockResolvedValue(null);
    const res = await callGet("USER", "user-1", "vehicle-inexistente");
    expect(res.status).toBe(404);
  });
});
