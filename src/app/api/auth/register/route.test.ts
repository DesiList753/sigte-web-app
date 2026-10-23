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
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: "new-user", role: "USER", ...data })
        ),
      },
    }),
  };
});

import { prisma } from "@/lib/prisma";
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

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(ORG as never);
  });

  it("crea al usuario en la organización del slug aunque el body diga otra", async () => {
    const res = await POST(request({ ...student, organizationId: "org-b" }));
    expect(res.status).toBe(200);
    expect(prisma.organization.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "org-a-slug" } })
    );
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: "org-a", role: "USER" }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: "org-a", action: "CREATE", entity: "USER", actorId: "new-user" }),
    });
  });

  it("busca el RUT repetido solo dentro de la organización", async () => {
    await POST(request(student));
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { organizationId_rut: { organizationId: "org-a", rut: "12.345.678-5" } },
    });
  });

  it("responde 404 si el slug no existe", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);
    const res = await POST(request(student));
    expect(res.status).toBe(404);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("no permite registrarse en una organización suspendida", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ ...ORG, status: "SUSPENDED" } as never);
    const res = await POST(request(student));
    expect(res.status).toBe(403);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("no permite registrarse si la organización cerró el registro", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ ...ORG, selfRegistration: false } as never);
    const res = await POST(request(student));
    expect(res.status).toBe(403);
  });

  it("no registra si la organización llegó al tope de usuarios de su plan", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ ...ORG, plan: { ...ORG.plan, maxUsers: 2 } } as never);
    vi.mocked(prisma.user.count).mockResolvedValueOnce(2);
    const res = await POST(request(student));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("PLAN_LIMIT");
    expect(body.error).toMatch(/máximo de usuarios/);
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: { organizationId: "org-a", active: true, role: { in: ["USER", "ADMIN"] } },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
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
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: "org-a", email: "conductor@test.cl", role: "USER" }),
    });
  });

  it("con el formulario básico no guarda datos académicos aunque vengan en el envío", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ ...ORG, registrationForm: "BASIC" } as never);
    await POST(request({ ...student, organizationId: "org-b", credentialId: "CRED-1" }));
    const { data } = vi.mocked(prisma.user.create).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.organizationId).toBe("org-a");
    expect(data).not.toHaveProperty("rut");
    expect(data).not.toHaveProperty("career");
    expect(data).not.toHaveProperty("credentialId");
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it("con el formulario académico exige el tipo de usuario", async () => {
    const res = await POST(request(basic));
    expect(res.status).toBe(400);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("revisa el estado de la organización antes de validar el formulario", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ ...ORG, status: "SUSPENDED" } as never);
    const res = await POST(request({ organizationSlug: "org-a-slug" }));
    expect(res.status).toBe(403);
  });
});
