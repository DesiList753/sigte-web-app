import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    membership: { findUnique: vi.fn() },
  },
}));

import { prisma } from "./prisma";
import { loadActor } from "./actor";

describe("loadActor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("arma la sesión de una organización desde la membresía de la persona", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      role: "GUARD",
      active: true,
      user: { id: "persona-1", email: "p@test.cl", name: "Persona" },
      organization: { status: "ACTIVE" },
    } as never);
    const actor = await loadActor("persona-1", "org-b");
    expect(prisma.membership.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_organizationId: { userId: "persona-1", organizationId: "org-b" } } })
    );
    expect(actor).toMatchObject({ id: "persona-1", role: "GUARD", active: true, organizationId: "org-b" });
  });

  it("sin membresía en esa organización no hay sesión", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);
    expect(await loadActor("persona-1", "org-ajena")).toBeNull();
  });

  it("sin organización solo VanillaSoft tiene sesión", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "root",
      email: "r@test.cl",
      name: "Root",
      platformAdmin: true,
    } as never);
    expect(await loadActor("root", null)).toMatchObject({ role: "SUPER_ADMIN", organizationId: null });

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "persona-1",
      email: "p@test.cl",
      name: "Persona",
      platformAdmin: false,
    } as never);
    expect(await loadActor("persona-1", null)).toBeNull();
  });
});
