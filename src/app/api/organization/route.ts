import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson, withTenant } from "@/lib/api";
import { auditData } from "@/lib/audit";
import { organizationSettingsSchema } from "@/lib/organization-schema";

const SELECT = {
  slug: true,
  name: true,
  displayName: true,
  logoUrl: true,
  brandColor: true,
  registrationForm: true,
  selfRegistration: true,
  allowedEmailDomains: true,
} as const;

export const GET = withTenant(
  async (_req, { session }) => {
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: SELECT,
    });
    return NextResponse.json({ organization });
  },
  { roles: ["ADMIN"] }
);

export const PATCH = withTenant(
  async (req, { session }) => {
    const parsed = await parseJson(req, organizationSettingsSchema);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

    const current = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: SELECT,
    });
    if (!current) return jsonError(404, "Organización no encontrada");

    const changed = (Object.keys(data) as (keyof typeof data)[]).filter(
      (key) => JSON.stringify(data[key]) !== JSON.stringify(current[key])
    );
    if (changed.length === 0) return NextResponse.json({ organization: current });

    const organization = await prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id: session.organizationId },
        data,
        select: SELECT,
      });
      await tx.auditLog.create({
        data: auditData({
          organizationId: session.organizationId,
          actor: session,
          action: "UPDATE",
          entity: "ORGANIZATION",
          entityId: session.organizationId,
          detail: { fields: changed },
        }),
      });
      return updated;
    });

    return NextResponse.json({ organization });
  },
  { roles: ["ADMIN"] }
);
