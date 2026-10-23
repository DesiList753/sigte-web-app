import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    membership: {
      findMany: vi.fn().mockResolvedValue([
        { role: "ADMIN", credentialId: "A-1", organization: { id: "org-a", slug: "a", displayName: "Org A", status: "ACTIVE" } },
        { role: "USER", credentialId: null, organization: { id: "org-c", slug: "c", displayName: "Org C", status: "ACTIVE" } },
      ]),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";
import { tenantRequest } from "@/test/tenant";

describe("GET /api/auth/me", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devuelve null sin sesión", async () => {
    const res = await GET(new NextRequest("http://localhost/api/auth/me"));
    expect((await res.json()).user).toBeNull();
    expect(prisma.membership.findMany).not.toHaveBeenCalled();
  });

  it("devuelve a la persona de la sesión con su organización activa y sus otras organizaciones", async () => {
    const res = await GET(await tenantRequest("/api/auth/me", { role: "ADMIN" }));
    const { user } = await res.json();
    expect(prisma.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "admin-a", active: true } })
    );
    expect(user).toMatchObject({ id: "admin-a", role: "ADMIN", credentialId: "A-1", organization: { id: "org-a" } });
    expect(user.organizations.map((o: { id: string }) => o.id)).toEqual(["org-a", "org-c"]);
  });
});
