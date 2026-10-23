import { describe, expect, it, vi, beforeEach } from "vitest";
import { signQrToken } from "@/lib/qr";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: { findUnique: vi.fn(), findFirst: vi.fn() },
    membership: { findUnique: vi.fn() },
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

  it("no busca por QR si el plan no incluye QR", async () => {
    const req = await tenantRequest("/api/access/lookup?qr=x", { role: "GUARD", plan: { name: "Sin QR", features: [] } });
    const res = await GET(req, params({}));
    expect(res.status).toBe(403);
    expect(prisma.vehicle.findFirst).not.toHaveBeenCalled();
  });

  it("sin infracciones en el plan no cuenta infracciones abiertas", async () => {
    vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({
      id: "v-a",
      plate: "AA1111",
      owner: { id: "u-a", name: "Dueña", email: "d@test.cl", memberships: [] },
    } as never);
    const req = await tenantRequest("/api/access/lookup?plate=AA1111", {
      role: "GUARD",
      plan: { name: "Básico", features: ["QR"] },
    });
    const body = await (await GET(req, params({}))).json();
    expect(body.openInfractions).toBe(0);
    expect(prisma.infraction.count).not.toHaveBeenCalled();
  });

  it("busca la credencial dentro de la organización de la sesión", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);
    await lookup("uid=USR-0001");
    expect(prisma.membership.findUnique).toHaveBeenCalledWith({
      where: { organizationId_credentialId: { organizationId: ORG_A, credentialId: "USR-0001" } },
      select: { userId: true },
    });
  });

  it("muestra la credencial y el rol del dueño solo en esta organización", async () => {
    vi.mocked(prisma.vehicle.findUnique).mockResolvedValue({
      id: "v-a",
      plate: "AA1111",
      owner: { id: "u-a", name: "Dueña", email: "d@test.cl", memberships: [{ role: "USER", credentialId: "C-A" }] },
    } as never);
    const body = await (await lookup("plate=AA1111")).json();
    expect(body.vehicle.owner).toEqual({ id: "u-a", name: "Dueña", email: "d@test.cl", role: "USER", credentialId: "C-A" });
    const args = vi.mocked(prisma.vehicle.findUnique).mock.calls[0][0] as {
      include: { owner: { select: { memberships: { where: unknown } } } };
    };
    expect(args.include.owner.select.memberships.where).toEqual({ organizationId: ORG_A });
  });

  it("rechaza a un USER", async () => {
    const res = await lookup("plate=BB1111", "USER");
    expect(res.status).toBe(403);
  });
});
