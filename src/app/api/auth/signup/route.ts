import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, homePath, setSessionCookie } from "@/lib/auth";
import { signToken } from "@/lib/jwt";
import { jsonError, parseJson } from "@/lib/api";
import { auditData } from "@/lib/audit";
import { SIGNUP_PLAN, createOrganization, slugSchema } from "@/lib/organizations";

const schema = z.object({
  organizationName: z.string().trim().min(2, "Escribe el nombre de la organización").max(120),
  slug: slugSchema,
  name: z.string().trim().min(2, "Escribe tu nombre").max(120),
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  website: z.string().optional(),
});

function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export async function POST(req: NextRequest) {
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;
  if (data.website) return jsonError(400, "No se pudo crear la cuenta");

  const email = data.email.toLowerCase();
  const [slugTaken, emailTaken, plan] = await Promise.all([
    prisma.organization.findUnique({ where: { slug: data.slug }, select: { id: true } }),
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.plan.findUnique({ where: { code: SIGNUP_PLAN }, select: { id: true, code: true } }),
  ]);
  if (slugTaken) return jsonError(409, "Ese enlace ya está en uso. Prueba con otro.");
  if (emailTaken) return jsonError(409, "Ese correo ya tiene una cuenta. Inicia sesión con él.");
  if (!plan) return jsonError(503, "El alta de organizaciones no está disponible");

  const passwordHash = await hashPassword(data.password);
  const created = await prisma
    .$transaction(async (tx) => {
      const result = await createOrganization(tx, {
        name: data.organizationName,
        displayName: data.organizationName,
        slug: data.slug,
        planId: plan.id,
        admin: { name: data.name, email, passwordHash },
      });
      const actor = { sub: result.admin.id, name: result.admin.name };
      await tx.auditLog.createMany({
        data: [
          auditData({
            organizationId: result.organization.id,
            actor,
            action: "CREATE",
            entity: "ORGANIZATION",
            entityId: result.organization.id,
            detail: { slug: data.slug, plan: plan.code },
          }),
          auditData({
            organizationId: result.organization.id,
            actor,
            action: "CREATE",
            entity: "USER",
            entityId: result.admin.id,
            detail: { email, role: "ADMIN" },
          }),
        ],
      });
      return result;
    })
    .catch((err) => {
      if (isUniqueViolation(err)) return null;
      throw err;
    });
  if (!created) return jsonError(409, "Ese enlace o correo ya está en uso. Prueba con otro.");

  const { organization, admin } = created;
  const token = await signToken({
    sub: admin.id,
    email: admin.email,
    role: admin.role,
    name: admin.name,
    organizationId: organization.id,
  });
  await setSessionCookie(token);

  return NextResponse.json(
    {
      organization: { id: organization.id, slug: organization.slug, displayName: organization.displayName },
      home: homePath(admin.role),
    },
    { status: 201 }
  );
}
