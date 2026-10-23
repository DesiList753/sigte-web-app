import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson, withPlatform } from "@/lib/api";
import { auditData } from "@/lib/audit";
import { slugSchema } from "@/lib/organizations";
import { organizationSettingsSchema } from "@/lib/organization-schema";
import { limitUsage } from "@/lib/plan";
import { usageByOrganization } from "@/lib/usage";

export const GET = withPlatform<{ id: string }>(async (_req, { params }) => {
  const organization = await prisma.organization.findUnique({
    where: { id: params.id },
    include: {
      plan: {
        select: {
          id: true,
          code: true,
          name: true,
          features: true,
          maxUsers: true,
          maxGuards: true,
          maxBlocks: true,
          maxVehicles: true,
        },
      },
      memberships: {
        where: { role: "ADMIN" },
        orderBy: { createdAt: "asc" },
        select: { active: true, createdAt: true, user: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!organization) return jsonError(404, "Organización no encontrada");

  const [usage, limits] = await Promise.all([
    usageByOrganization(organization.id),
    limitUsage(organization.id, organization.plan),
  ]);
  const { memberships, ...rest } = organization;
  const admins = memberships.map(({ user, ...membership }) => ({ ...user, ...membership }));
  return NextResponse.json({
    organization: { ...rest, admins, usage: usage.get(organization.id), limits },
  });
});

const patchSchema = organizationSettingsSchema.extend({
  name: z.string().min(2).optional(),
  slug: slugSchema.optional(),
  planId: z.string().min(1).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
});

export const PATCH = withPlatform<{ id: string }>(async (req, { session, params }) => {
  const parsed = await parseJson(req, patchSchema);
  if (!parsed.ok) return parsed.response;
  const { planId, status, ...fields } = parsed.data;

  const current = await prisma.organization.findUnique({
    where: { id: params.id },
    include: { plan: { select: { code: true } } },
  });
  if (!current) return jsonError(404, "Organización no encontrada");

  if (fields.slug && fields.slug !== current.slug) {
    const taken = await prisma.organization.findUnique({ where: { slug: fields.slug }, select: { id: true } });
    if (taken) return jsonError(409, "Ya existe una organización con ese slug");
  }

  let plan: { id: string; code: string } | null = null;
  if (planId && planId !== current.planId) {
    plan = await prisma.plan.findUnique({ where: { id: planId }, select: { id: true, code: true } });
    if (!plan) return jsonError(400, "Plan no encontrado");
  }

  const base = { organizationId: current.id, actor: session, entity: "ORGANIZATION" as const, entityId: current.id };
  const logs: Prisma.AuditLogCreateManyInput[] = [];
  const changed = (Object.keys(fields) as (keyof typeof fields)[]).filter(
    (key) => JSON.stringify(fields[key]) !== JSON.stringify(current[key])
  );
  if (changed.length) logs.push(auditData({ ...base, action: "UPDATE", detail: { fields: changed } }));
  if (plan) logs.push(auditData({ ...base, action: "PLAN_CHANGE", detail: { from: current.plan.code, to: plan.code } }));
  if (status && status !== current.status) {
    logs.push(auditData({ ...base, action: status === "SUSPENDED" ? "SUSPEND" : "REACTIVATE" }));
  }

  const organization = await prisma.$transaction(async (tx) => {
    const updated = await tx.organization.update({
      where: { id: current.id },
      data: { ...fields, ...(plan ? { planId: plan.id } : {}), ...(status ? { status } : {}) },
    });
    if (logs.length) await tx.auditLog.createMany({ data: logs });
    return updated;
  });

  return NextResponse.json({ organization });
});
