import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    passwordResetToken: {
      count: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { POST } from "./route";

function request(email: string) {
  return new NextRequest("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("siempre responde el mismo mensaje genérico, exista o no el usuario", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const res = await POST(request("nadie@organizacion.cl"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.message).toMatch(/si el correo existe/i);
  });

  it("crea un token y envía el correo si el usuario existe y no superó el límite", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1", email: "u@organizacion.cl" } as never);
    vi.mocked(prisma.passwordResetToken.count).mockResolvedValue(0);

    await POST(request("u@organizacion.cl"));

    expect(prisma.passwordResetToken.create).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it("no crea un nuevo token ni envía correo si ya se pidieron 3+ en la ventana de 15 min", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1", email: "u@organizacion.cl" } as never);
    vi.mocked(prisma.passwordResetToken.count).mockResolvedValue(3);

    const res = await POST(request("u@organizacion.cl"));
    const body = await res.json();

    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(body.message).toMatch(/si el correo existe/i);
  });
});
