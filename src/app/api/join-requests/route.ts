import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/api";

export const GET = withTenant(
  async (_req, { session }) => {
    const memberships = await prisma.membership.findMany({
      where: { organizationId: session.organizationId, status: "PENDING" },
      orderBy: { updatedAt: "asc" },
      select: {
        id: true,
        userType: true,
        position: true,
        department: true,
        academicDepartment: true,
        career: true,
        credentialId: true,
        updatedAt: true,
        user: { select: { name: true, email: true, phone: true, rut: true } },
      },
    });
    const requests = memberships.map(({ user, updatedAt, ...membership }) => ({
      ...user,
      ...membership,
      requestedAt: updatedAt,
    }));
    return NextResponse.json({ requests });
  },
  { roles: ["ADMIN"] }
);
