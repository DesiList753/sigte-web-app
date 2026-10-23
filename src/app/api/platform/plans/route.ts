import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson, withPlatform } from "@/lib/api";
import { auditData } from "@/lib/audit";
import { planSchema } from "@/lib/plan-schema";

export const GET = withPlatform(async () => {
  const plans = await prisma.plan.findMany({
    orderBy: { maxUsers: { sort: "asc", nulls: "last" } },
    include: { _count: { select: { organizations: true } } },
  });
  return NextResponse.json({ plans });
});

export const POST = withPlatform(async (req, { session }) => {
  const parsed = await parseJson(req, planSchema);
  if (!parsed.ok) return parsed.response;
  const data = { ...parsed.data, features: Array.from(new Set(parsed.data.features)) };

  const exists = await prisma.plan.findUnique({ where: { code: data.code }, select: { id: true } });
  if (exists) return jsonError(409, "Ya existe un plan con ese código");

  const plan = await prisma.$transaction(async (tx) => {
    const created = await tx.plan.create({ data });
    await tx.auditLog.create({
      data: auditData({
        organizationId: null,
        actor: session,
        action: "CREATE",
        entity: "PLAN",
        entityId: created.id,
        detail: { name: created.name },
      }),
    });
    return created;
  });
  return NextResponse.json({ plan }, { status: 201 });
});
