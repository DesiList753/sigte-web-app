import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { homePath, setSessionCookie } from "@/lib/auth";
import { signToken } from "@/lib/jwt";
import { jsonError, parseJson, planError, withAccount } from "@/lib/api";
import { auditData } from "@/lib/audit";
import { hashResetToken } from "@/lib/passwordReset";
import { limitBlock, limitKindFor } from "@/lib/plan";

const schema = z.object({ token: z.string().min(1) });

export const POST = withAccount(async (req, { account }) => {
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;

  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashResetToken(parsed.data.token) },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      organizationId: true,
      organization: {
        select: {
          status: true,
          plan: {
            select: { name: true, features: true, maxUsers: true, maxGuards: true, maxBlocks: true, maxVehicles: true },
          },
        },
      },
    },
  });
  if (!invitation || invitation.expiresAt < new Date()) {
    return jsonError(404, "La invitación no existe o ya venció. Pide una nueva a la organización.");
  }
  if (invitation.email !== account.email) {
    return jsonError(403, "Esta invitación es para otro correo. Inicia sesión con la cuenta invitada.");
  }
  if (invitation.organization.status !== "ACTIVE") {
    return jsonError(403, "La cuenta de esa organización está suspendida", { code: "ORG_SUSPENDED" });
  }

  const organizationId = invitation.organizationId;
  const current = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: account.id, organizationId } },
    select: { id: true, role: true, status: true, active: true },
  });
  const alreadyMember = current?.status === "ACTIVE" && current.active;
  const role = alreadyMember ? current.role : invitation.role;

  if (!alreadyMember) {
    const limited = await limitBlock(organizationId, invitation.organization.plan, limitKindFor(role), {
      member: true,
    });
    if (limited) return planError(limited);
  }

  await prisma.$transaction(async (tx) => {
    if (!alreadyMember) {
      const state = { role, status: "ACTIVE" as const, active: true };
      if (current) await tx.membership.update({ where: { id: current.id }, data: state });
      else await tx.membership.create({ data: { userId: account.id, organizationId, ...state } });
      await tx.auditLog.create({
        data: auditData({
          organizationId,
          actor: { sub: account.id, name: account.name },
          action: "CREATE",
          entity: "USER",
          entityId: account.id,
          detail: { email: account.email, role, invitation: true },
        }),
      });
    }
    await tx.invitation.delete({ where: { id: invitation.id } });
    await tx.user.update({ where: { id: account.id }, data: { lastOrganizationId: organizationId } });
  });

  const token = await signToken({ sub: account.id, email: account.email, role, name: account.name, organizationId });
  await setSessionCookie(token);
  return NextResponse.json({ organizationId, home: homePath(role) });
});
