import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ set: vi.fn(), get: vi.fn(), delete: vi.fn() }),
}));

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    membership: { findUnique: vi.fn() },
    user: { update: vi.fn().mockResolvedValue({}) },
  },
}));

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { POST } from "./route";
import { ORG_A, ORG_B, onlyMemberOf, platformRequest, tenantRequest } from "@/test/tenant";

async function cookieSet() {
  return vi.mocked((await cookies()).set);
}

async function switchTo(organizationId: string) {
  const req = await tenantRequest("/api/auth/switch", { role: "USER", sub: "persona-1" }, { method: "POST", body: { organizationId } });
  return POST(req);
}

describe("POST /api/auth/switch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.membership.findUnique).mockImplementation(
      onlyMemberOf(ORG_B, { role: "GUARD", active: true, organization: { status: "ACTIVE" } })
    );
  });

  it("cambia a otra organización de la persona con el rol que tiene ahí", async () => {
    const res = await switchTo(ORG_B);
    expect(res.status).toBe(200);
    expect((await res.json()).home).toBe("/guard");
    expect(prisma.membership.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_organizationId: { userId: "persona-1", organizationId: ORG_B } } })
    );
    const [, token] = (await cookieSet()).mock.calls[0];
    expect(await verifyToken(token as string)).toMatchObject({ sub: "persona-1", organizationId: ORG_B, role: "GUARD" });
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "persona-1" }, data: { lastOrganizationId: ORG_B } });
  });

  it("no deja entrar a una organización a la que la persona no pertenece", async () => {
    const res = await switchTo("org-ajena");
    expect(res.status).toBe(404);
    expect(await cookieSet()).not.toHaveBeenCalled();
  });

  it("no deja entrar con una membresía desactivada", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      role: "USER",
      active: false,
      organization: { status: "ACTIVE" },
    } as never);
    const res = await switchTo(ORG_B);
    expect(res.status).toBe(404);
    expect(await cookieSet()).not.toHaveBeenCalled();
  });

  it("no deja entrar a una organización suspendida", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      role: "USER",
      active: true,
      organization: { status: "SUSPENDED" },
    } as never);
    const res = await switchTo(ORG_B);
    expect(res.status).toBe(403);
    expect(await cookieSet()).not.toHaveBeenCalled();
  });

  it("pide sesión y no aplica a VanillaSoft", async () => {
    const res = await POST(await platformRequest("/api/auth/switch", { method: "POST", body: { organizationId: ORG_A } }));
    expect(res.status).toBe(401);
    expect(prisma.membership.findUnique).not.toHaveBeenCalled();
  });
});
