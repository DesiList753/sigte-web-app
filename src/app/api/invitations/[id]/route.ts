import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, withTenant } from "@/lib/api";
import { auditData } from "@/lib/audit";

export const DELETE = withTenant<{ id: string }>(
  async (_req, { session, params }) => {
    const organizationId = session.organizationId;
    const invitation = await prisma.invitation.findFirst({
      where: { id: params.id, organizationId },
      select: { id: true, email: true, role: true },
    });
    if (!invitation) return jsonError(404, "Invitación no encontrada");

    await prisma.$transaction([
      prisma.invitation.delete({ where: { id: invitation.id } }),
      prisma.auditLog.create({
        data: auditData({
          organizationId,
          actor: session,
          action: "DELETE",
          entity: "USER",
          entityId: invitation.id,
          detail: { email: invitation.email, role: invitation.role, invitation: true },
        }),
      }),
    ]);
    return NextResponse.json({ ok: true });
  },
  { roles: ["ADMIN"] }
);
