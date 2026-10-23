import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { jsonError, parseJson, planError, withTenant } from "@/lib/api";
import { auditData } from "@/lib/audit";
import { limitBlock, limitKindFor } from "@/lib/plan";

export const GET = withTenant(
  async (req, { session }) => {
    const q = new URL(req.url).searchParams.get("q")?.trim();

    const where: Prisma.UserWhereInput = { organizationId: session.organizationId };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q.toLowerCase() } },
        { rut: { contains: q } },
        { credentialId: { contains: q } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: q ? 20 : 100,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        userType: true,
        rut: true,
        phone: true,
        position: true,
        department: true,
        academicDepartment: true,
        career: true,
        credentialId: true,
        active: true,
        createdAt: true,
        _count: { select: { vehicles: true } },
      },
    });
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

    const exists = await prisma.user.findUnique({ where: { email: emailLower } });
    if (exists) return jsonError(409, "Email ya existe");

    if (credentialId) {
      const collision = await prisma.user.findUnique({
        where: { organizationId_credentialId: { organizationId, credentialId } },
      });
      if (collision) return jsonError(409, "La credencial ya existe en tu organización");
    }

    const limited = await limitBlock(organizationId, session.plan, limitKindFor(role));
    if (limited) return planError(limited);

    const passwordHash = await hashPassword(password);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { organizationId, email: emailLower, passwordHash, name, role, credentialId: credentialId || null },
        select: { id: true, email: true, name: true, role: true, credentialId: true, active: true },
      });
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
