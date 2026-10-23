import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson, withTenant } from "@/lib/api";
import { auditData } from "@/lib/audit";

const patchSchema = z.object({
  status: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"]),
  resolution: z.string().optional(),
});

export const PATCH = withTenant<{ id: string }>(
  async (req, { session, params }) => {
    const parsed = await parseJson(req, patchSchema);
    if (!parsed.ok) return parsed.response;
    const { status, resolution } = parsed.data;

    const infraction = await prisma.infraction.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      include: { vehicle: { select: { plate: true } } },
    });
    if (!infraction) return jsonError(404, "Infracción no encontrada");

    if (session.role === "USER") {
      if (status !== "ACKNOWLEDGED")
        return jsonError(403, "Solo puedes reconocer la infracción");
      if (infraction.userId !== session.sub)
        return jsonError(403, "No eres el dueño de esta infracción");
      if (infraction.status !== "OPEN")
        return jsonError(400, "La infracción ya fue procesada");
    }

    const closes = session.role !== "USER" && (status === "RESOLVED" || status === "DISMISSED");
    const update = prisma.infraction.update({
      where: { id: infraction.id },
      data: closes
        ? { status, resolvedById: session.sub, resolvedAt: new Date(), ...(resolution ? { resolution } : {}) }
        : { status },
    });

    if (!closes) return NextResponse.json({ infraction: await update });

    const [updated] = await prisma.$transaction([
      update,
      prisma.auditLog.create({
        data: auditData({
          organizationId: session.organizationId,
          actor: session,
          action: "RESOLVE",
          entity: "INFRACTION",
          entityId: infraction.id,
          detail: { plate: infraction.vehicle.plate, status },
        }),
      }),
    ]);
    return NextResponse.json({ infraction: updated });
  },
  { roles: ["USER", "GUARD", "ADMIN"], feature: "INFRACTIONS" }
);
