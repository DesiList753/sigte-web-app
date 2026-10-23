import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { jsonError, parseJson, withPlatform } from "@/lib/api";
import { auditData } from "@/lib/audit";
import { createOrganization, slugSchema } from "@/lib/organizations";
import { usageByOrganization } from "@/lib/usage";

export const GET = withPlatform(async () => {
  const [organizations, usage] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        displayName: true,
        status: true,
        createdAt: true,
        plan: { select: { id: true, code: true, name: true } },
      },
    }),
    usageByOrganization(),
  ]);
  return NextResponse.json({
    organizations: organizations.map((o) => ({ ...o, usage: usage.get(o.id) })),
  });
});

const createSchema = z.object({
  name: z.string().min(2),
  displayName: z.string().min(2),
  slug: slugSchema,
  planId: z.string().min(1),
  admin: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  }),
});

export const POST = withPlatform(async (req, { session }) => {
  const parsed = await parseJson(req, createSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;
  const email = data.admin.email.toLowerCase();

  const [slugTaken, emailTaken, plan] = await Promise.all([
    prisma.organization.findUnique({ where: { slug: data.slug }, select: { id: true } }),
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.plan.findUnique({ where: { id: data.planId }, select: { id: true, code: true } }),
  ]);
  if (slugTaken) return jsonError(409, "Ya existe una organización con ese slug");
  if (emailTaken) return jsonError(409, "El correo del administrador ya está registrado");
  if (!plan) return jsonError(400, "Plan no encontrado");

  const passwordHash = await hashPassword(data.admin.password);
  const { organization, admin } = await prisma.$transaction(async (tx) => {
    const created = await createOrganization(tx, {
      name: data.name,
      displayName: data.displayName,
      slug: data.slug,
      planId: plan.id,
      admin: { name: data.admin.name, email, passwordHash },
    });
    await tx.auditLog.createMany({
      data: [
        auditData({
          organizationId: created.organization.id,
          actor: session,
          action: "CREATE",
          entity: "ORGANIZATION",
          entityId: created.organization.id,
          detail: { slug: data.slug, plan: plan.code },
        }),
        auditData({
          organizationId: created.organization.id,
          actor: session,
          action: "CREATE",
          entity: "USER",
          entityId: created.admin.id,
          detail: { email, role: "ADMIN" },
        }),
      ],
    });
    return created;
  });

  return NextResponse.json(
    { organization, admin: { id: admin.id, email: admin.email, name: admin.name } },
    { status: 201 }
  );
});
