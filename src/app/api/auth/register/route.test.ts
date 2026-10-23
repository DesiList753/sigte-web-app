import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ set: vi.fn(), get: vi.fn(), delete: vi.fn() }),
}));

vi.mock("@/lib/prisma", async () => {
  const { mockPrismaWithAudit } = await import("@/test/prisma");
  return {
    prisma: mockPrismaWithAudit({
      organization: { findUnique: vi.fn() },
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: "new-user", email: data.email, name: data.name })
        ),
        update: vi.fn().mockImplementation(({ where }) =>
          Promise.resolve({ id: where.id, email: "persona@test.cl", name: "Persona" })
        ),
      },
      membership: {
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({}),
      },
    }),
  };
});

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { verifyToken } from "@/lib/jwt";
import { POST } from "./route";

const ORG = {
  id: "org-a",
  status: "ACTIVE",
  selfRegistration: true,
  registrationForm: "ACADEMIC",
  allowedEmailDomains: [] as string[],
  plan: { name: "Básico", features: ["QR"], maxUsers: null, maxGuards: null, maxBlocks: null, maxVehicles: null },
};

const basic = {
  organizationSlug: "org-a-slug",
  name: "Conductor Prueba",
  email: "conductor@test.cl",
  password: "segura123",
  phone: "+56 9 3333 4444",
};

const student = {
  userType: "STUDENT",
  organizationSlug: "org-a-slug",
  name: "Alumna Prueba",
  email: "alumna@test.cl",
  password: "segura123",
  phone: "+56 9 1111 2222",
  rut: "12.345.678-5",
  academicDepartment: "Informática",
  career: "Ingeniería",
};

function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function existingPerson(overrides: Record<string, unknown> = {}) {
  return {
    id: "persona-1",
    passwordHash: await hashPassword(student.password),
    platformAdmin: false,
    rut: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    memberships: [],
    ...overrides,
  };
}

function withExisting(person: Record<string, unknown>) {
  vi.mocked(prisma.user.findUnique).mockImplementation((async (args: { where: { email?: string } }) =>
    args.where.email ? person : null) as never);
}

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(ORG as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
  });

  it("crea a la persona y su membresía en la organización del slug aunque el envío diga otra", async () => {
    const res = await POST(request({ ...student, organizationId: "org-b" }));
    expect(res.status).toBe(200);
    expect(prisma.organization.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "org-a-slug" } })
    );
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: "alumna@test.cl", rut: "12.345.678-5", lastOrganizationId: "org-a" }),
      select: expect.any(Object),
    });
    expect(prisma.membership.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "new-user", organizationId: "org-a", role: "USER", career: "Ingeniería" }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: "org-a", action: "CREATE", entity: "USER", actorId: "new-user" }),
    });
  });

  it("busca el RUT repetido en todo el sistema, porque es de la persona", async () => {
    await POST(request(student));
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { rut: "12.345.678-5" }, select: { id: true } });
  });

  it("responde 404 si el slug no existe", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);
    const res = await POST(request(student));
    expect(res.status).toBe(404);
    expect(prisma.membership.create).not.toHaveBeenCalled();
  });

  it("no permite registrarse en una organización suspendida", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ ...ORG, status: "SUSPENDED" } as never);
    const res = await POST(request(student));
    expect(res.status).toBe(403);
    expect(prisma.membership.create).not.toHaveBeenCalled();
  });

  it("no permite registrarse si la organización cerró el registro", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ ...ORG, selfRegistration: false } as never);
    const res = await POST(request(student));
    expect(res.status).toBe(403);
  });

  it("no registra si la organización llegó al tope de usuarios de su plan", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ ...ORG, plan: { ...ORG.plan, maxUsers: 2 } } as never);
    vi.mocked(prisma.membership.count).mockResolvedValueOnce(2);
    const res = await POST(request(student));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("PLAN_LIMIT");
    expect(body.error).toMatch(/máximo de usuarios/);
    expect(prisma.membership.count).toHaveBeenCalledWith({
      where: { organizationId: "org-a", active: true, role: { in: ["USER", "ADMIN"] } },
    });
    expect(prisma.membership.create).not.toHaveBeenCalled();
  });

  it("exige un correo de los dominios permitidos", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ ...ORG, allowedEmailDomains: ["organizacion.cl"] } as never);
    const rejected = await POST(request(student));
    expect(rejected.status).toBe(400);
    const accepted = await POST(request({ ...student, email: "alumna@alumnos.organizacion.cl" }));
    expect(accepted.status).toBe(200);
  });

  it("con el formulario básico pide solo nombre, correo, teléfono y contraseña", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ ...ORG, registrationForm: "BASIC" } as never);
    const res = await POST(request(basic));
    expect(res.status).toBe(200);
    expect(prisma.membership.create).toHaveBeenCalledWith({
      data: { userId: "new-user", organizationId: "org-a", role: "USER" },
    });
  });

  it("con el formulario básico no guarda datos académicos aunque vengan en el envío", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ ...ORG, registrationForm: "BASIC" } as never);
    await POST(request({ ...student, organizationId: "org-b", credentialId: "CRED-1" }));
    const user = vi.mocked(prisma.user.create).mock.calls[0][0] as { data: Record<string, unknown> };
    const member = vi.mocked(prisma.membership.create).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(user.data.rut).toBeNull();
    expect(member.data).toEqual({ userId: "new-user", organizationId: "org-a", role: "USER" });
  });

  it("una cuenta nueva necesita una contraseña de al menos 8 caracteres", async () => {
    const res = await POST(request({ ...student, password: "corta1" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/8 caracteres/);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("con el formulario académico exige el tipo de usuario", async () => {
    const res = await POST(request(basic));
    expect(res.status).toBe(400);
    expect(prisma.membership.create).not.toHaveBeenCalled();
  });

  it("revisa el estado de la organización antes de validar el formulario", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ ...ORG, status: "SUSPENDED" } as never);
    const res = await POST(request({ organizationSlug: "org-a-slug" }));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/auth/register con una cuenta que ya existe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(ORG as never);
  });

  it("la persona se une a otra organización con su contraseña actual", async () => {
    withExisting(await existingPerson());
    const res = await POST(request(student));
    expect(res.status).toBe(200);
    expect((await res.json()).joined).toBe(true);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.membership.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "persona-1", organizationId: "org-a", role: "USER" }),
    });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "persona-1" },
        data: expect.objectContaining({ lastOrganizationId: "org-a", rut: "12.345.678-5" }),
      })
    );
    const [, token] = vi.mocked((await cookies()).set).mock.calls[0];
    expect(await verifyToken(token as string)).toMatchObject({ sub: "persona-1", organizationId: "org-a" });
  });

  it("con una contraseña distinta no se une y cuenta el intento fallido", async () => {
    withExisting(await existingPerson({ failedLoginAttempts: 1 }));
    const res = await POST(request({ ...student, password: "otra-clave-123" }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("ACCOUNT_EXISTS");
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "persona-1" }, data: { failedLoginAttempts: 2 } });
    expect(prisma.membership.create).not.toHaveBeenCalled();
  });

  it("no se une dos veces a la misma organización", async () => {
    withExisting(await existingPerson({ memberships: [{ id: "mbr-1" }] }));
    const res = await POST(request(student));
    expect(res.status).toBe(409);
    expect(prisma.membership.create).not.toHaveBeenCalled();
  });

  it("el RUT tiene que coincidir con el de su cuenta", async () => {
    withExisting(await existingPerson({ rut: "11.111.111-1" }));
    const res = await POST(request(student));
    expect(res.status).toBe(409);
    expect(prisma.membership.create).not.toHaveBeenCalled();
  });

  it("una cuenta bloqueada por intentos no puede unirse", async () => {
    withExisting(await existingPerson({ lockedUntil: new Date(Date.now() + 5 * 60_000) }));
    const res = await POST(request(student));
    expect(res.status).toBe(429);
    expect(prisma.membership.create).not.toHaveBeenCalled();
  });

  it("puede unirse aunque su contraseña sea anterior a la regla de 8 caracteres", async () => {
    withExisting({ ...(await existingPerson()), passwordHash: await hashPassword("user123") });
    const res = await POST(request({ ...student, password: "user123" }));
    expect(res.status).toBe(200);
    expect(prisma.membership.create).toHaveBeenCalled();
  });

  it("la cuenta de VanillaSoft no se une a organizaciones", async () => {
    withExisting(await existingPerson({ platformAdmin: true }));
    const res = await POST(request(student));
    expect(res.status).toBe(409);
    expect(prisma.membership.create).not.toHaveBeenCalled();
  });
});
