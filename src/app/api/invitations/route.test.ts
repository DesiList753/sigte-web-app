import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/email", () => ({ sendInvitationEmail: vi.fn().mockResolvedValue(undefined) }));

vi.mock("@/lib/prisma", async () => {
  const { mockPrismaWithAudit } = await import("@/test/prisma");
  return {
    prisma: mockPrismaWithAudit({
      invitation: {
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockImplementation(({ create }) =>
          Promise.resolve({ id: "inv-1", email: create.email, role: create.role, expiresAt: create.expiresAt, createdAt: new Date() })
        ),
      },
      membership: { findFirst: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(0) },
    }),
  };
});

import { prisma } from "@/lib/prisma";
import { sendInvitationEmail } from "@/lib/email";
import { hashResetToken } from "@/lib/passwordReset";
import { GET, POST } from "./route";
import { ORG_A, ORG_B, auditedIn, params, scopedTo, tenantRequest } from "@/test/tenant";

async function invite(body: Record<string, unknown>, as: Parameters<typeof tenantRequest>[1] = { role: "ADMIN" }) {
  const req = await tenantRequest("/api/invitations", as, { method: "POST", body });
  return POST(req, params({}));
}

describe("GET /api/invitations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("solo lista las invitaciones de la organización de la sesión y sin el token", async () => {
    await GET(await tenantRequest("/api/invitations", { role: "ADMIN", organizationId: ORG_B }), params({}));
    expect(prisma.invitation.findMany).toHaveBeenCalledWith(scopedTo(ORG_B));
    const { select } = vi.mocked(prisma.invitation.findMany).mock.calls[0][0] as { select: Record<string, boolean> };
    expect(select.tokenHash).toBeUndefined();
  });

  it("solo la administración ve las invitaciones", async () => {
    const res = await GET(await tenantRequest("/api/invitations", { role: "GUARD" }), params({}));
    expect(res.status).toBe(403);
    expect(prisma.invitation.findMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/invitations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("crea la invitación en la organización de la sesión aunque el envío diga otra", async () => {
    const res = await invite({ email: "Nueva@Test.cl", role: "GUARD", organizationId: ORG_B });
    expect(res.status).toBe(201);
    const { link, invitation } = await res.json();
    expect(invitation).toMatchObject({ email: "nueva@test.cl", role: "GUARD" });
    const token = link.split("/invitacion/")[1];
    expect(prisma.invitation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId_email: { organizationId: ORG_A, email: "nueva@test.cl" } },
        create: expect.objectContaining({
          organizationId: ORG_A,
          email: "nueva@test.cl",
          role: "GUARD",
          invitedById: "admin-a",
          tokenHash: hashResetToken(token),
        }),
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(auditedIn(ORG_A, "CREATE", "USER"));
    expect(sendInvitationEmail).toHaveBeenCalledWith("nueva@test.cl", "Org A", link);
  });

  it("busca si el correo ya es miembro solo dentro de la organización de la sesión", async () => {
    vi.mocked(prisma.membership.findFirst).mockResolvedValueOnce({ id: "mbr-1" } as never);
    const res = await invite({ email: "miembro@test.cl" });
    expect(res.status).toBe(409);
    expect(prisma.membership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG_A, status: "ACTIVE", user: { email: "miembro@test.cl" } } })
    );
    expect(prisma.invitation.upsert).not.toHaveBeenCalled();
    expect(sendInvitationEmail).not.toHaveBeenCalled();
  });

  it("no invita si el plan llegó al tope del rol", async () => {
    vi.mocked(prisma.membership.count).mockResolvedValueOnce(3);
    const res = await invite({ email: "nueva@test.cl" }, { role: "ADMIN", plan: { name: "Básico", maxUsers: 3 } });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("PLAN_LIMIT");
    expect(prisma.invitation.upsert).not.toHaveBeenCalled();
  });

  it("solo la administración invita", async () => {
    for (const role of ["USER", "GUARD"] as const) {
      expect((await invite({ email: "nueva@test.cl" }, { role })).status).toBe(403);
    }
    expect(prisma.invitation.upsert).not.toHaveBeenCalled();
  });

  it("valida el correo y el rol", async () => {
    expect((await invite({ email: "no-es-correo" })).status).toBe(400);
    expect((await invite({ email: "nueva@test.cl", role: "SUPER_ADMIN" })).status).toBe(400);
    expect(prisma.invitation.upsert).not.toHaveBeenCalled();
  });
});
