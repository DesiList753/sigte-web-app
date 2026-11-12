import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ set: vi.fn(), get: vi.fn(), delete: vi.fn() }),
}));

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn(), loadAccount: vi.fn() }));

vi.mock("@/lib/prisma", async () => {
  const { mockPrismaWithAudit } = await import("@/test/prisma");
  return {
    prisma: mockPrismaWithAudit({
      invitation: { findUnique: vi.fn(), delete: vi.fn().mockResolvedValue({}) },
      user: { update: vi.fn().mockResolvedValue({}) },
      membership: {
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
    }),
  };
});

import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { hashResetToken } from "@/lib/passwordReset";
import { POST } from "./route";
import { ORG_B, accountRequest, auditedIn, params } from "@/test/tenant";

const PLAN = { name: "Básico", features: ["QR"], maxUsers: null, maxGuards: null, maxBlocks: null, maxVehicles: null };

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    email: "persona-1@test.cl",
    role: "GUARD",
    expiresAt: new Date(Date.now() + 60_000),
    organizationId: ORG_B,
    organization: { status: "ACTIVE", plan: PLAN },
    ...overrides,
  };
}

function withInvitation(overrides: Record<string, unknown> = {}) {
  vi.mocked(prisma.invitation.findUnique).mockResolvedValue(invitation(overrides) as never);
}

async function accept(as: Parameters<typeof accountRequest>[1] = {}, token = "token-1") {
  const req = await accountRequest("/api/account/invitations", as, { method: "POST", body: { token } });
  return POST(req, params({}));
}

async function cookieSet() {
  return vi.mocked((await cookies()).set);
}

describe("POST /api/account/invitations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withInvitation();
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);
  });

  it("pide sesión", async () => {
    const req = new NextRequest("http://localhost/api/account/invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "token-1" }),
    });
    expect((await POST(req, params({}))).status).toBe(401);
    expect(prisma.invitation.findUnique).not.toHaveBeenCalled();
  });

  it("acepta la invitación con el rol y la organización que definió quien invitó", async () => {
    const res = await accept();
    expect(res.status).toBe(200);
    expect((await res.json()).home).toBe("/guard");
    expect(prisma.invitation.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashResetToken("token-1") } })
    );
    expect(prisma.membership.create).toHaveBeenCalledWith({
      data: { userId: "persona-1", organizationId: ORG_B, role: "GUARD", status: "ACTIVE", active: true },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(auditedIn(ORG_B, "CREATE", "USER"));
    expect(prisma.invitation.delete).toHaveBeenCalledWith({ where: { id: "inv-1" } });
    const [, token] = (await cookieSet()).mock.calls[0];
    expect(await verifyToken(token as string)).toMatchObject({ sub: "persona-1", organizationId: ORG_B, role: "GUARD" });
  });

  it("otra cuenta no puede usar una invitación ajena aunque tenga el enlace", async () => {
    const res = await accept({ sub: "intrusa", email: "intrusa@test.cl" });
    expect(res.status).toBe(403);
    expect(prisma.membership.create).not.toHaveBeenCalled();
    expect(prisma.invitation.delete).not.toHaveBeenCalled();
    expect(await cookieSet()).not.toHaveBeenCalled();
  });

  it("rechaza un enlace que no existe o que ya venció", async () => {
    vi.mocked(prisma.invitation.findUnique).mockResolvedValue(null);
    expect((await accept()).status).toBe(404);
    withInvitation({ expiresAt: new Date(Date.now() - 1000) });
    expect((await accept()).status).toBe(404);
    expect(prisma.membership.create).not.toHaveBeenCalled();
  });

  it("no entra a una organización suspendida", async () => {
    withInvitation({ organization: { status: "SUSPENDED", plan: PLAN } });
    expect((await accept()).status).toBe(403);
    expect(prisma.membership.create).not.toHaveBeenCalled();
  });

  it("respeta el tope del plan según el rol invitado", async () => {
    withInvitation({ organization: { status: "ACTIVE", plan: { ...PLAN, maxGuards: 1 } } });
    vi.mocked(prisma.membership.count).mockResolvedValueOnce(1);
    const res = await accept();
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("PLAN_LIMIT");
    expect(prisma.membership.count).toHaveBeenCalledWith({
      where: { organizationId: ORG_B, active: true, status: "ACTIVE", role: "GUARD" },
    });
    expect(prisma.membership.create).not.toHaveBeenCalled();
  });

  it("convierte en miembro activo a quien tenía una solicitud pendiente", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      id: "mbr-1",
      role: "USER",
      status: "PENDING",
      active: false,
    } as never);
    await accept();
    expect(prisma.membership.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_organizationId: { userId: "persona-1", organizationId: ORG_B } } })
    );
    expect(prisma.membership.update).toHaveBeenCalledWith({
      where: { id: "mbr-1" },
      data: { role: "GUARD", status: "ACTIVE", active: true },
    });
    expect(prisma.membership.create).not.toHaveBeenCalled();
  });

  it("a quien ya era miembro no le cambia el rol", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      id: "mbr-1",
      role: "ADMIN",
      status: "ACTIVE",
      active: true,
    } as never);
    const res = await accept();
    expect((await res.json()).home).toBe("/admin");
    expect(prisma.membership.update).not.toHaveBeenCalled();
    expect(prisma.membership.create).not.toHaveBeenCalled();
    expect(prisma.invitation.delete).toHaveBeenCalledWith({ where: { id: "inv-1" } });
  });
});
