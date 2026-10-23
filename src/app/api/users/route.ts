import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { jsonError, parseJson, planError, withTenant } from "@/lib/api";
import { auditData } from "@/lib/audit";
import { memberByCredential } from "@/lib/members";
import { limitBlock, limitKindFor } from "@/lib/plan";

export const GET = withTenant(
  async (req, { session }) => {
    const q = new URL(req.url).searchParams.get("q")?.trim();
    const organizationId = session.organizationId;

    const where: Prisma.MembershipWhereInput = { organizationId };
    if (q) {
      where.OR = [
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q.toLowerCase() } } },
        { user: { rut: { contains: q } } },
        { credentialId: { contains: q } },
      ];
    }

    const memberships = await prisma.membership.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: q ? 20 : 100,
      select: {
        role: true,
        userType: true,
        position: true,
        department: true,
        academicDepartment: true,
        career: true,
        credentialId: true,
        active: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            rut: true,
            phone: true,
            _count: { select: { vehicles: { where: { organizationId } } } },
          },
        },
      },
    });
    const users = memberships.map(({ user, ...membership }) => ({ ...user, ...membership }));
    return NextResponse.json({ users });
  },
  { roles: ["ADMIN"] }
);

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  role: z.enum(["USER", "GUARD", "ADMIN"]),
  credentialId: z.string().optional(),
});

export const POST = withTenant(
  async (req, { session }) => {
    const parsed = await parseJson(req, createSchema);
    if (!parsed.ok) return parsed.response;
    const { email, password, name, role, credentialId } = parsed.data;
    const emailLower = email.toLowerCase();
    const organizationId = session.organizationId;

    const exists = await prisma.user.findUnique({ where: { email: emailLower }, select: { id: true } });
    if (exists) {
      return jsonError(
        409,
        "Ese correo ya tiene cuenta en S.I.G.T.E. Pídele que se una con el enlace de registro de tu organización."
      );
    }

    if (credentialId && (await memberByCredential(organizationId, credentialId))) {
      return jsonError(409, "La credencial ya existe en tu organización");
    }

    const limited = await limitBlock(organizationId, session.plan, limitKindFor(role));
    if (limited) return planError(limited);

    const passwordHash = await hashPassword(password);
    const user = await prisma.$transaction(async (tx) => {
      const person = await tx.user.create({
        data: { email: emailLower, passwordHash, name, lastOrganizationId: organizationId },
        select: { id: true, email: true, name: true },
      });
      const membership = await tx.membership.create({
        data: { userId: person.id, organizationId, role, credentialId: credentialId || null },
        select: { role: true, credentialId: true, active: true },
      });
      const created = { ...person, ...membership };
      await tx.auditLog.create({
        data: auditData({
          organizationId,
          actor: session,
          action: "CREATE",
          entity: "USER",
          entityId: created.id,
          detail: { email: created.email, role: created.role },
        }),
      });
      return created;
    });
    return NextResponse.json({ user }, { status: 201 });
  },
  { roles: ["ADMIN"] }
);
