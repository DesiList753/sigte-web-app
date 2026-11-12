import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", async () => {
  const { mockPrismaWithAudit } = await import("@/test/prisma");
  return {
    prisma: mockPrismaWithAudit({
      invitation: { findFirst: vi.fn(), delete: vi.fn().mockResolvedValue({}) },
    }),
  };
});

import { prisma } from "@/lib/prisma";
import { DELETE } from "./route";
import { ORG_A, ORG_B, auditedIn, onlyInOrg, params, tenantRequest } from "@/test/tenant";

async function revoke(as: Parameters<typeof tenantRequest>[1] = { role: "ADMIN" }) {
  const req = await tenantRequest("/api/invitations/inv-1", as, { method: "DELETE" });
  return DELETE(req, params({ id: "inv-1" }));
}

describe("DELETE /api/invitations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.invitation.findFirst).mockImplementation(
      onlyInOrg(ORG_A, { id: "inv-1", email: "nueva@test.cl", role: "USER" })
    );
  });

  it("anula la invitación de su organización y deja auditoría", async () => {
    const res = await revoke();
    expect(res.status).toBe(200);
    expect(prisma.invitation.delete).toHaveBeenCalledWith({ where: { id: "inv-1" } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(auditedIn(ORG_A, "DELETE", "USER"));
  });

  it("un ADMIN de otra organización no puede anularla", async () => {
    const res = await revoke({ role: "ADMIN", sub: "admin-b", organizationId: ORG_B });
    expect(res.status).toBe(404);
    expect(prisma.invitation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "inv-1", organizationId: ORG_B } })
    );
    expect(prisma.invitation.delete).not.toHaveBeenCalled();
  });

  it("solo la administración anula invitaciones", async () => {
    expect((await revoke({ role: "GUARD" })).status).toBe(403);
    expect(prisma.invitation.findFirst).not.toHaveBeenCalled();
  });
});
