import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ set: vi.fn(), get: vi.fn(), delete: vi.fn() }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
  },
}));

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { COOKIE_NAME, verifyToken } from "@/lib/jwt";
import { POST } from "./route";

async function cookieSet() {
  return vi.mocked((await cookies()).set);
}

function request(email: string, password: string, extra: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, ...extra }),
  });
}

const CORRECT_PASSWORD = "correcta123";
let correctHash: string;

function membership(organizationId: string, role = "USER", status = "ACTIVE") {
  return { role, organizationId, organization: { slug: `${organizationId}-slug`, status } };
}

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "u@test.cl",
    passwordHash: correctHash,
    name: "Usuario",
    platformAdmin: false,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastOrganizationId: "org-a",
    memberships: [membership("org-a")],
    ...overrides,
  } as never;
}

const platformUser = { platformAdmin: true, lastOrganizationId: null, memberships: [] };

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    correctHash = await hashPassword(CORRECT_PASSWORD);
  });

  it("bloquea el login si lockedUntil es futuro", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user({ lockedUntil: new Date(Date.now() + 5 * 60_000) }));
    const res = await POST(request("u@test.cl", CORRECT_PASSWORD));
    expect(res.status).toBe(429);
  });

  it("incrementa failedLoginAttempts en un intento fallido", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user({ failedLoginAttempts: 2 }));
    const res = await POST(request("u@test.cl", "incorrecta"));
    expect(res.status).toBe(401);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { failedLoginAttempts: 3 },
    });
  });

  it("bloquea 15 minutos al llegar al 5to intento fallido", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user({ failedLoginAttempts: 4 }));
    await POST(request("u@test.cl", "incorrecta"));
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({ failedLoginAttempts: 0, lockedUntil: expect.any(Date) }),
    });
  });

  it("resetea el contador en un login exitoso tras intentos previos", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user({ failedLoginAttempts: 2 }));
    const res = await POST(request("u@test.cl", CORRECT_PASSWORD));
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  });

  it("guarda la sesión con la organización solo en la cookie", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user());
    const res = await POST(request("u@test.cl", CORRECT_PASSWORD));
    const body = await res.json();
    expect(body.home).toBe("/user");
    expect(body.token).toBeUndefined();
    const [name, token] = (await cookieSet()).mock.calls[0];
    expect(name).toBe(COOKIE_NAME);
    expect((await verifyToken(token as string))?.organizationId).toBe("org-a");
  });

  it("rechaza el login si la organización está suspendida", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user({ memberships: [membership("org-a", "USER", "SUSPENDED")] }));
    const res = await POST(request("u@test.cl", CORRECT_PASSWORD));
    expect(res.status).toBe(403);
    expect(await cookieSet()).not.toHaveBeenCalled();
  });

  it("permite al SUPER_ADMIN entrar sin organización", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user(platformUser));
    const res = await POST(request("u@test.cl", CORRECT_PASSWORD));
    expect(res.status).toBe(200);
    expect((await res.json()).home).toBe("/platform");
  });

  it("entra por el enlace de su propia organización", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user());
    const res = await POST(request("u@test.cl", CORRECT_PASSWORD, { organizationSlug: "org-a-slug" }));
    expect(res.status).toBe(200);
  });

  it("no entra por el enlace de otra organización aunque la clave sea correcta", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user());
    const res = await POST(request("u@test.cl", CORRECT_PASSWORD, { organizationSlug: "org-b-slug" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Credenciales inválidas");
    expect(await cookieSet()).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("el SUPER_ADMIN no entra por el enlace de una organización", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user(platformUser));
    const res = await POST(request("u@test.cl", CORRECT_PASSWORD, { organizationSlug: "org-a-slug" }));
    expect(res.status).toBe(401);
  });

  it("sin membresías activas no entra aunque la clave sea correcta", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user({ memberships: [] }));
    const res = await POST(request("u@test.cl", CORRECT_PASSWORD));
    expect(res.status).toBe(401);
    expect(await cookieSet()).not.toHaveBeenCalled();
  });

  it("solo considera las membresías activas", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user());
    await POST(request("u@test.cl", CORRECT_PASSWORD));
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ memberships: expect.objectContaining({ where: { active: true } }) }),
      })
    );
  });

  it("con varias organizaciones entra a la última que usó y con el rol que tiene ahí", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      user({ lastOrganizationId: "org-b", memberships: [membership("org-a"), membership("org-b", "GUARD")] })
    );
    const res = await POST(request("u@test.cl", CORRECT_PASSWORD));
    expect((await res.json()).home).toBe("/guard");
    const [, token] = (await cookieSet()).mock.calls[0];
    expect(await verifyToken(token as string)).toMatchObject({ organizationId: "org-b", role: "GUARD" });
  });

  it("por el enlace de una organización entra a esa y la recuerda", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      user({ lastOrganizationId: "org-b", memberships: [membership("org-a", "ADMIN"), membership("org-b")] })
    );
    const res = await POST(request("u@test.cl", CORRECT_PASSWORD, { organizationSlug: "org-a-slug" }));
    expect((await res.json()).home).toBe("/admin");
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { lastOrganizationId: "org-a" } });
  });

  it("si una organización está suspendida entra a otra activa", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      user({ memberships: [membership("org-a", "USER", "SUSPENDED"), membership("org-b")] })
    );
    const res = await POST(request("u@test.cl", CORRECT_PASSWORD));
    expect(res.status).toBe(200);
    const [, token] = (await cookieSet()).mock.calls[0];
    expect((await verifyToken(token as string))?.organizationId).toBe("org-b");
  });
});
