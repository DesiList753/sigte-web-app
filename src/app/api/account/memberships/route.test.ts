import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ set: vi.fn(), get: vi.fn(), delete: vi.fn() }),
}));

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn(), loadAccount: vi.fn() }));

vi.mock("@/lib/prisma", async () => {
  const { mockPrismaWithAudit } = await import("@/test/prisma");
  return {
    prisma: mockPrismaWithAudit({
      organization: { findUnique: vi.fn() },
      user: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn().mockResolvedValue({}) },
      membership: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([{ userId: "admin-a" }]),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
      notification: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    }),
  };
});

import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { POST } from "./route";
import { ORG_A, accountRequest, auditedIn, params } from "@/test/tenant";

const ORG = {
  id: ORG_A,
  displayName: "Org A",
  status: "ACTIVE",
  joinPolicy: "APPROVAL",
  credentialsEnabled: true,
  registrationForm: "BASIC",
  allowedEmailDomains: [] as string[],
  plan: { name: "Organizacional", features: ["QR", "CREDENTIALS"], maxUsers: null, maxGuards: null, maxBlocks: null, maxVehicles: null },
};

const student = { userType: "STUDENT", rut: "12.345.678-5", academicDepartment: "Informática", career: "Ingeniería" };

function withOrg(overrides: Record<string, unknown> = {}) {
  vi.mocked(prisma.organization.findUnique).mockResolvedValue({ ...ORG, ...overrides } as never);
}

async function join(body: Record<string, unknown> = {}, as: Parameters<typeof accountRequest>[1] = {}) {
  const req = await accountRequest(
    "/api/account/memberships",
    as,
    { method: "POST", body: { organizationSlug: "org-a-slug", ...body } }
  );
  return POST(req, params({}));
}

async function cookieSet() {
  return vi.mocked((await cookies()).set);
}

describe("POST /api/account/memberships", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withOrg();
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);
  });

  it("pide sesión", async () => {
    const req = new NextRequest("http://localhost/api/account/memberships", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationSlug: "org-a-slug" }),
    });
    const res = await POST(req, params({}));
    expect(res.status).toBe(401);
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it("no aplica a la cuenta de VanillaSoft", async () => {
    const res = await join({}, { platformAdmin: true });
    expect(res.status).toBe(401);
    expect(prisma.membership.create).not.toHaveBeenCalled();
  });

  it("con aprobación crea la solicitud pendiente para la persona de la sesión, aunque el envío diga otra", async () => {
    const res = await join({ userId: "otra-persona", role: "ADMIN", status: "ACTIVE", active: true });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ pending: true, home: "/cuenta" });
    expect(prisma.organization.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "org-a-slug" } })
    );
    expect(prisma.membership.create).toHaveBeenCalledWith({
      data: { userId: "persona-1", organizationId: ORG_A, role: "USER", status: "PENDING", active: false },
    });
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ organizationId: ORG_A, userId: "admin-a" })],
    });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(await cookieSet()).not.toHaveBeenCalled();
  });

  it("con ingreso abierto entra de inmediato y la sesión pasa a esa organización", async () => {
    withOrg({ joinPolicy: "OPEN" });
    const res = await join();
    expect(await res.json()).toMatchObject({ pending: false, home: "/user" });
    expect(prisma.membership.create).toHaveBeenCalledWith({
      data: { userId: "persona-1", organizationId: ORG_A, role: "USER", status: "ACTIVE", active: true },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(auditedIn(ORG_A, "CREATE", "USER"));
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "persona-1" }, data: { lastOrganizationId: ORG_A } });
    const [, token] = (await cookieSet()).mock.calls[0];
    expect(await verifyToken(token as string)).toMatchObject({ sub: "persona-1", organizationId: ORG_A, role: "USER" });
  });

  it("con ingreso abierto respeta el tope de usuarios del plan", async () => {
    withOrg({ joinPolicy: "OPEN", plan: { ...ORG.plan, maxUsers: 2 } });
    vi.mocked(prisma.membership.count).mockResolvedValueOnce(2);
    const res = await join();
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("PLAN_LIMIT");
    expect(prisma.membership.create).not.toHaveBeenCalled();
  });

  it("no deja unirse a una organización solo por invitación ni a una suspendida", async () => {
    withOrg({ joinPolicy: "INVITE_ONLY" });
    expect((await join()).status).toBe(403);
    withOrg({ status: "SUSPENDED" });
    expect((await join()).status).toBe(403);
    expect(prisma.membership.create).not.toHaveBeenCalled();
  });

  it("responde 404 si el código no existe", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);
    expect((await join()).status).toBe(404);
  });

  it("exige un correo de los dominios permitidos", async () => {
    withOrg({ allowedEmailDomains: ["organizacion.cl"] });
    expect((await join()).status).toBe(400);
    expect((await join({}, { email: "persona@alumnos.organizacion.cl" })).status).toBe(201);
  });

  it("busca la membresía previa solo de la persona de la sesión en esa organización", async () => {
    await join();
    expect(prisma.membership.findUnique).toHaveBeenCalledWith({
      where: { userId_organizationId: { userId: "persona-1", organizationId: ORG_A } },
      select: { id: true, status: true },
    });
  });

  it("no repite una solicitud pendiente ni se une dos veces", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ id: "mbr-1", status: "PENDING" } as never);
    expect((await join()).status).toBe(409);
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ id: "mbr-1", status: "ACTIVE" } as never);
    expect((await join()).status).toBe(409);
    expect(prisma.membership.create).not.toHaveBeenCalled();
    expect(prisma.membership.update).not.toHaveBeenCalled();
  });

  it("tras un rechazo vuelve a solicitar sobre la misma membresía", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ id: "mbr-1", status: "REJECTED" } as never);
    const res = await join();
    expect(res.status).toBe(201);
    expect(prisma.membership.create).not.toHaveBeenCalled();
    expect(prisma.membership.update).toHaveBeenCalledWith({
      where: { id: "mbr-1" },
      data: expect.objectContaining({ role: "USER", status: "PENDING", active: false }),
    });
  });

  it("con el formulario académico exige los datos y guarda el RUT en la cuenta", async () => {
    withOrg({ registrationForm: "ACADEMIC" });
    expect((await join()).status).toBe(400);
    const res = await join(student);
    expect(res.status).toBe(201);
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "persona-1" }, data: { rut: "12.345.678-5" } });
    expect(prisma.membership.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userType: "STUDENT", career: "Ingeniería", status: "PENDING" }),
    });
  });

  it("el RUT tiene que coincidir con el de la cuenta y no puede ser de otra persona", async () => {
    withOrg({ registrationForm: "ACADEMIC" });
    expect((await join(student, { rut: "11.111.111-1" })).status).toBe(409);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: "otra" } as never);
    expect((await join(student)).status).toBe(409);
    expect(prisma.membership.create).not.toHaveBeenCalled();
  });

  it("sin credenciales activadas no guarda ni revisa la credencial", async () => {
    withOrg({ registrationForm: "ACADEMIC", credentialsEnabled: false });
    const res = await join({ ...student, credentialId: "C-1" });
    expect(res.status).toBe(201);
    expect(prisma.membership.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ credentialId: null }),
    });
    expect(prisma.membership.findUnique).toHaveBeenCalledTimes(1);
  });

  it("revisa la credencial repetida dentro de la organización", async () => {
    withOrg({ registrationForm: "ACADEMIC" });
    vi.mocked(prisma.membership.findUnique).mockImplementation((async (args: { where: Record<string, unknown> }) =>
      args.where.organizationId_credentialId ? { id: "mbr-otro", userId: "otro" } : null) as never);
    const res = await join({ ...student, credentialId: "C-1" });
    expect(res.status).toBe(409);
    expect(prisma.membership.findUnique).toHaveBeenCalledWith({
      where: { organizationId_credentialId: { organizationId: ORG_A, credentialId: "C-1" } },
      select: { id: true, userId: true },
    });
    expect(prisma.membership.create).not.toHaveBeenCalled();
  });
});
