import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    membership: { count: vi.fn().mockResolvedValue(0) },
    parkingBlock: { count: vi.fn().mockResolvedValue(0) },
    vehicle: { count: vi.fn().mockResolvedValue(0) },
  },
}));

import { prisma } from "@/lib/prisma";
import { featureBlock, limitBlock, limitKindFor, limitUsage, type PlanInfo } from "./plan";

const basico: PlanInfo = {
  name: "Básico",
  features: ["QR"],
  maxUsers: 100,
  maxGuards: 2,
  maxBlocks: 3,
  maxVehicles: 150,
};

describe("limitBlock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deja crear mientras no se llega al tope", async () => {
    vi.mocked(prisma.membership.count).mockResolvedValueOnce(1);
    expect(await limitBlock("org-a", basico, "guards")).toBeNull();
  });

  it("bloquea al llegar al tope con un mensaje claro", async () => {
    vi.mocked(prisma.membership.count).mockResolvedValueOnce(2);
    const block = await limitBlock("org-a", basico, "guards");
    expect(block?.message).toBe("Tu plan Básico permite hasta 2 guardias. Contacta a VanillaSoft para ampliarlo.");
    expect(block?.extra).toEqual({ code: "PLAN_LIMIT", limit: "guards", max: 2, used: 2 });
  });

  it("no cuenta nada si el plan no tiene límite", async () => {
    expect(await limitBlock("org-a", { ...basico, maxVehicles: null }, "vehicles")).toBeNull();
    expect(prisma.vehicle.count).not.toHaveBeenCalled();
  });

  it("usa un mensaje distinto para quien se registra solo", async () => {
    vi.mocked(prisma.membership.count).mockResolvedValueOnce(100);
    const block = await limitBlock("org-a", basico, "users", { member: true });
    expect(block?.message).toMatch(/alcanzó el máximo de usuarios/);
  });

  it("cuenta solo los registros activos de la propia organización", async () => {
    await limitBlock("org-a", basico, "users");
    expect(prisma.membership.count).toHaveBeenCalledWith({
      where: { organizationId: "org-a", active: true, role: { in: ["USER", "ADMIN"] } },
    });
    await limitBlock("org-a", basico, "guards");
    expect(prisma.membership.count).toHaveBeenLastCalledWith({
      where: { organizationId: "org-a", active: true, role: "GUARD" },
    });
  });

  it("no cuenta el bloque por defecto", async () => {
    await limitBlock("org-a", basico, "blocks");
    expect(prisma.parkingBlock.count).toHaveBeenCalledWith({
      where: { organizationId: "org-a", defaultOf: { is: null } },
    });
  });
});

describe("limitUsage", () => {
  it("devuelve uso y máximo de cada límite", async () => {
    vi.mocked(prisma.membership.count).mockResolvedValueOnce(10).mockResolvedValueOnce(1);
    vi.mocked(prisma.parkingBlock.count).mockResolvedValueOnce(2);
    vi.mocked(prisma.vehicle.count).mockResolvedValueOnce(30);
    expect(await limitUsage("org-a", basico)).toEqual({
      users: { used: 10, max: 100 },
      guards: { used: 1, max: 2 },
      blocks: { used: 2, max: 3 },
      vehicles: { used: 30, max: 150 },
    });
  });
});

describe("featureBlock y limitKindFor", () => {
  it("bloquea una función que el plan no incluye", () => {
    expect(featureBlock(basico, "QR")).toBeNull();
    expect(featureBlock(basico, "REPORTS")).toEqual({
      message: "Tu plan Básico no incluye los reportes. Contacta a VanillaSoft para ampliarlo.",
      extra: { code: "PLAN_FEATURE", feature: "REPORTS" },
    });
  });

  it("los guardias tienen su propio límite; usuarios y admins comparten el otro", () => {
    expect(limitKindFor("GUARD")).toBe("guards");
    expect(limitKindFor("USER")).toBe("users");
    expect(limitKindFor("ADMIN")).toBe("users");
  });
});
