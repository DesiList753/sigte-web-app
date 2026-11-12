import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson, planError, withTenant } from "@/lib/api";
import { auditData } from "@/lib/audit";
import { sendInvitationEmail } from "@/lib/email";
import { generateResetToken, hashResetToken, INVITATION_TTL_MS } from "@/lib/passwordReset";
import { limitBlock, limitKindFor } from "@/lib/plan";

export const GET = withTenant(
  async (_req, { session }) => {
    const invitations = await prisma.invitation.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    });
    return NextResponse.json({ invitations });
  },
  { roles: ["ADMIN"] }
);

const createSchema = z.object({
  email: z.string().email("Correo inválido"),
  role: z.enum(["USER", "GUARD", "ADMIN"]).default("USER"),
});

export const POST = withTenant(
  async (req, { session }) => {
    const parsed = await parseJson(req, createSchema);
    if (!parsed.ok) return parsed.response;
    const { role } = parsed.data;
    const email = parsed.data.email.toLowerCase();
    const organizationId = session.organizationId;

    const member = await prisma.membership.findFirst({
      where: { organizationId, status: "ACTIVE", user: { email } },
      select: { id: true },
    });
    if (member) return jsonError(409, "Ese correo ya pertenece a tu organización");

    const limited = await limitBlock(organizationId, session.plan, limitKindFor(role));
    if (limited) return planError(limited);

    const token = generateResetToken();
    const fresh = {
      role,
      tokenHash: hashResetToken(token),
      invitedById: session.sub,
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    };
    const invitation = await prisma.$transaction(async (tx) => {
      const saved = await tx.invitation.upsert({
        where: { organizationId_email: { organizationId, email } },
        update: { ...fresh, createdAt: new Date() },
        create: { organizationId, email, ...fresh },
        select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      });
      await tx.auditLog.create({
        data: auditData({
          organizationId,
          actor: session,
          action: "CREATE",
          entity: "USER",
          entityId: saved.id,
          detail: { email, role, invitation: true },
        }),
      });
      return saved;
    });

    const appUrl = process.env.APP_URL ?? new URL(req.url).origin;
    const link = `${appUrl}/invitacion/${token}`;
    await sendInvitationEmail(email, session.organization.displayName, link);

    return NextResponse.json({ invitation, link }, { status: 201 });
  },
  { roles: ["ADMIN"] }
);
