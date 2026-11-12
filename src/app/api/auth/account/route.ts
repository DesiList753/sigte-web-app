import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ACCOUNT_HOME, hashPassword, setSessionCookie } from "@/lib/auth";
import { signToken } from "@/lib/jwt";
import { jsonError, parseJson } from "@/lib/api";

const schema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre completo"),
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  phone: z.string().trim().min(6, "Teléfono inválido"),
});

export async function POST(req: NextRequest) {
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;
  const { name, password, phone } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) return jsonError(409, "Ese correo ya tiene cuenta en S.I.G.T.E. Inicia sesión.");

  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword(password), name, phone },
    select: { id: true, email: true, name: true },
  });

  const token = await signToken({
    sub: user.id,
    email: user.email,
    role: "USER",
    name: user.name,
    organizationId: null,
  });
  await setSessionCookie(token);

  return NextResponse.json({ id: user.id, email: user.email, name: user.name, home: ACCOUNT_HOME }, { status: 201 });
}
