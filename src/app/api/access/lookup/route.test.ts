import { describe, expect, it, vi, beforeEach } from "vitest";
import { signQrToken } from "@/lib/qr";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: { findUnique: vi.fn(), findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    infraction: { count: vi.fn().mockResolvedValue(0) },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";
import { ORG_A, ORG_B, onlyInOrg, params, tenantRequest } from "@/test/tenant";

const vehicleB = { id: "vehicle-b", plate: "BB1111", ownerId: "user-b", organizationId: ORG_B };

async function lookup(query: string, role: "GUARD" | "USER" = "GUARD") {
  return GET(await tenantRequest(`/api/access/lookup?${query}`, { role }), params({}));
}

describe("GET /api/access/lookup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("busca la patente dentro de la organización de la sesión", async () => {
    vi.mocked(prisma.vehicle.findUnique).mockResolvedValue(null);
    await lookup("plate=bb1111");
    expect(prisma.vehicle.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId_plate: { organizationId: ORG_A, plate: "BB1111" } } })
    );
  });

  it("no devuelve el vehículo de otra organización al escanear su QR", async () => {
    vi.mocked(prisma.vehicle.findFirst).mockImplementation(onlyInOrg(ORG_B, vehicleB));
    const res = await lookup(`qr=${encodeURIComponent(signQrToken(vehicleB.id))}`);
    expect((await res.json()).vehicle).toBeNull();
    expect(prisma.vehicle.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: vehicleB.id, organizationId: ORG_A } })
    );
  });

  it("busca la credencial dentro de la organización de la sesión", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    await lookup("uid=USR-0001");
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { organizationId_universityId: { organizationId: ORG_A, universityId: "USR-0001" } },
    });
  });

  it("rechaza a un USER", async () => {
    const res = await lookup("plate=BB1111", "USER");
    expect(res.status).toBe(403);
  });
});
