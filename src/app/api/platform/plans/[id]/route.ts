import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson, withPlatform } from "@/lib/api";
import { auditData } from "@/lib/audit";
import { planPatchSchema } from "@/lib/plan-schema";

export const PATCH = withPlatform<{ id: string }>(async (req, { session, params }) => {
  const parsed = await parseJson(req, planPatchSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data.features
    ? { ...parsed.data, features: Array.from(new Set(parsed.data.features)) }
    : parsed.data;

  const current = await prisma.plan.findUnique({ where: { id: params.id } });
  if (!current) return jsonError(404, "Plan no encontrado");

  const changed = (Object.keys(data) as (keyof typeof data)[]).filter(
    (key) => JSON.stringify(data[key]) !== JSON.stringify(current[key])
  );

  const plan = await prisma.$transaction(async (tx) => {
    const updated = await tx.plan.update({ where: { id: current.id }, data });
    if (changed.length) {
      await tx.auditLog.create({
        data: auditData({
          organizationId: null,
          actor: session,
          action: "UPDATE",
          entity: "PLAN",
          entityId: current.id,
          detail: { name: updated.name, fields: changed },
        }),
      });
    }
    return updated;
  });
  return NextResponse.json({ plan });
});
