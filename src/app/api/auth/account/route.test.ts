import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ set: vi.fn(), get: vi.fn(), delete: vi.fn() }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: "new-user", email: data.email, name: data.name })
      ),
    },
    membership: { create: vi.fn() },
  },
}));

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { verifyToken } from "@/lib/jwt";
import { POST } from "./route";

const person = { name: "Conductora Prueba", email: "Conductora@Test.cl", password: "segura123", phone: "+56 9 1111 2222" };

function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/auth/account", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
  });

  it("crea la cuenta sin organización y abre una sesión sin organización", async () => {
    const res = await POST(request({ ...person, organizationId: "org-b", role: "ADMIN", platformAdmin: true }));
    expect(res.status).toBe(201);
    expect((await res.json()).home).toBe("/cuenta");
    const created = vi.mocked(prisma.user.create).mock.calls[0][0] as unknown as { data: Record<string, string> };
    expect(Object.keys(created.data).sort()).toEqual(["email", "name", "passwordHash", "phone"]);
    expect(created.data.email).toBe("conductora@test.cl");
    expect(await verifyPassword(person.password, created.data.passwordHash)).toBe(true);
    expect(prisma.membership.create).not.toHaveBeenCalled();
    const [, token] = vi.mocked((await cookies()).set).mock.calls[0];
    expect(await verifyToken(token as string)).toMatchObject({ sub: "new-user", role: "USER", organizationId: null });
  });

  it("no crea una segunda cuenta con el mismo correo", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "existente" } as never);
    const res = await POST(request(person));
    expect(res.status).toBe(409);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(vi.mocked((await cookies()).set)).not.toHaveBeenCalled();
  });

  it("exige una contraseña de al menos 8 caracteres", async () => {
    const res = await POST(request({ ...person, password: "corta1" }));
    expect(res.status).toBe(400);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
