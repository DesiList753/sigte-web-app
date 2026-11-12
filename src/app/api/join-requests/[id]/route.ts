import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson, planError, withTenant } from "@/lib/api";
import { auditData } from "@/lib/audit";
import { limitBlock } from "@/lib/plan";

const schema = z.object({ action: z.enum(["approve", "reject"]) });

export const PATCH = withTenant<{ id: string }>(
  async (req, { session, params }) => {
    const parsed = await parseJson(req, schema);
    if (!parsed.ok) return parsed.response;
    const approve = parsed.data.action === "approve";
    const organizationId = session.organizationId;

    const request = await prisma.membership.findFirst({
      where: { id: params.id, organizationId, status: "PENDING" },
      select: { id: true, userId: true, user: { select: { email: true } } },
    });
    if (!request) return jsonError(404, "Solicitud no encontrada");

    if (approve) {
      const limited = await limitBlock(organizationId, session.plan, "users");
      if (limited) return planError(limited);
    }

    await prisma.$transaction(async (tx) => {
      await tx.membership.update({
        where: { id: request.id },
        data: approve ? { status: "ACTIVE", active: true } : { status: "REJECTED", active: false, credentialId: null },
      });
      if (approve) {
        await tx.notification.create({
          data: {
            organizationId,
            userId: request.userId,
            kind: "SYSTEM",
            title: "Solicitud aceptada",
            message: `Ya eres parte de ${session.organization.displayName}. Puedes registrar tus vehículos.`,
          },
        });
      }
      await tx.auditLog.create({
        data: auditData({
          organizationId,
          actor: session,
          action: approve ? "CREATE" : "UPDATE",
          entity: "USER",
          entityId: request.userId,
          detail: { email: request.user.email, request: approve ? "ACCEPTED" : "REJECTED" },
        }),
      });
    });
    return NextResponse.json({ ok: true, status: approve ? "ACTIVE" : "REJECTED" });
  },
  { roles: ["ADMIN"] }
);
