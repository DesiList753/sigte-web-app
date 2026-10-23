import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn().mockResolvedValue({ id: "admin-a" }) },
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
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("devuelve solo al usuario de la sesión con su organización", async () => {
    await GET(await tenantRequest("/api/auth/me", { role: "ADMIN" }));
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "admin-a" },
        select: expect.objectContaining({ organization: expect.any(Object) }),
      })
    );
  });
});
