import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ set: vi.fn(), get: vi.fn(), delete: vi.fn() }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization: { findUnique: vi.fn() },
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: "new-user", role: "USER", ...data })
      ),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { POST } from "./route";

const ORG = {
  id: "org-a",
  status: "ACTIVE",
  selfRegistration: true,
  allowedEmailDomains: [] as string[],
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

  it("exige un correo de los dominios permitidos", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ ...ORG, allowedEmailDomains: ["usm.cl"] } as never);
    const rejected = await POST(request(student));
    expect(rejected.status).toBe(400);
    const accepted = await POST(request({ ...student, email: "alumna@sansano.usm.cl" }));
    expect(accepted.status).toBe(200);
  });
});
