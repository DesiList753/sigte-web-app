import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ set: vi.fn(), get: vi.fn(), delete: vi.fn() }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization: { findUnique: vi.fn(), create: vi.fn() },
    parkingBlock: { create: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    plan: { findUnique: vi.fn() },
    auditLog: { createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { COOKIE_NAME, verifyToken } from "@/lib/jwt";
import { POST } from "./route";

const tx = {
  organization: { create: vi.fn() },
  parkingBlock: { create: vi.fn() },
  user: { create: vi.fn() },
  auditLog: { createMany: vi.fn() },
};

const form = {
  organizationName: "Clínica Los Andes",
  slug: "clinica-los-andes",
  name: "Ana Pérez",
  email: "Ana@Clinica.cl",
  password: "segura123",
  website: "",
};

function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function cookieSet() {
  return vi.mocked((await cookies()).set);
}

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.plan.findUnique).mockResolvedValue({ id: "plan_basico", code: "basico" } as never);
    vi.mocked(prisma.$transaction).mockImplementation(((fn: (client: typeof tx) => unknown) => fn(tx)) as never);
    tx.organization.create.mockImplementation(({ data }) => Promise.resolve({ id: "org-new", ...data }));
    tx.parkingBlock.create.mockResolvedValue({ id: "block-new" });
    tx.user.create.mockImplementation(({ data }) => Promise.resolve({ id: "admin-new", ...data }));
    tx.auditLog.createMany.mockResolvedValue({ count: 2 });
  });

  it("crea la organización, su bloque por defecto y su administrador en una sola transacción", async () => {
    const res = await POST(request(form));
    expect(res.status).toBe(201);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.organization.create).toHaveBeenCalledWith({
      data: {
        name: "Clínica Los Andes",
        displayName: "Clínica Los Andes",
        slug: "clinica-los-andes",
        planId: "plan_basico",
      },
    });
    expect(tx.parkingBlock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-new",
        name: "No definido",
        defaultOf: { connect: { id: "org-new" } },
      }),
    });
    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: "ana@clinica.cl", lastOrganizationId: "org-new", memberships: { create: { organizationId: "org-new", role: "ADMIN" } } }),
    });
    expect(tx.auditLog.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ organizationId: "org-new", entity: "ORGANIZATION", action: "CREATE", actorId: "admin-new" }),
        expect.objectContaining({ organizationId: "org-new", entity: "USER", action: "CREATE", actorId: "admin-new" }),
      ],
    });
    expect(prisma.organization.create).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect((await res.json()).home).toBe("/admin");
    const [name, token] = (await cookieSet()).mock.calls[0];
    expect(name).toBe(COOKIE_NAME);
    expect(await verifyToken(token as string)).toMatchObject({
      sub: "admin-new",
      role: "ADMIN",
      organizationId: "org-new",
    });
  });

  it("si falla una parte del alta no responde éxito ni abre sesión", async () => {
    tx.user.create.mockRejectedValueOnce(new Error("fallo en la base"));
    await expect(POST(request(form))).rejects.toThrow("fallo en la base");
    expect(tx.auditLog.createMany).not.toHaveBeenCalled();
    expect(await cookieSet()).not.toHaveBeenCalled();
  });

  it("responde 409 si el enlace ya está en uso", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: "org-a" } as never);
    const res = await POST(request(form));
    expect(res.status).toBe(409);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("responde 409 si el correo ya tiene cuenta", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u-1" } as never);
    const res = await POST(request(form));
    expect(res.status).toBe(409);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("responde 409 si otra alta tomó el mismo enlace al mismo tiempo", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" })
    );
    const res = await POST(request(form));
    expect(res.status).toBe(409);
    expect(await cookieSet()).not.toHaveBeenCalled();
  });

  it("ignora el plan, el rol y la organización que vengan en el envío", async () => {
    await POST(
      request({ ...form, planId: "plan_institucional", organizationId: "org-b", role: "SUPER_ADMIN", status: "SUSPENDED" })
    );
    expect(prisma.plan.findUnique).toHaveBeenCalledWith({ where: { code: "basico" }, select: { id: true, code: true } });
    expect(tx.organization.create).toHaveBeenCalledWith({
      data: expect.not.objectContaining({ status: expect.anything() }),
    });
    expect(tx.organization.create).toHaveBeenCalledWith({ data: expect.objectContaining({ planId: "plan_basico" }) });
    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ memberships: { create: { organizationId: "org-new", role: "ADMIN" } } }),
    });
  });

  it("descarta el envío si el campo oculto viene lleno", async () => {
    const res = await POST(request({ ...form, website: "https://spam.example" }));
    expect(res.status).toBe(400);
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rechaza un enlace con mayúsculas o espacios", async () => {
    const res = await POST(request({ ...form, slug: "Clinica Los Andes" }));
    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
